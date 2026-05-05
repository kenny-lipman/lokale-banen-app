import { safeFetch, SsrfBlockedError, FetchSizeExceededError } from './website/ssrf-fetch'
import { htmlToMarkdown, truncateForLLM, wordCount } from './website/markdown'
import { discoverInfoPages } from './website/page-discovery'
import { discoverCareerPage } from './website/career-page-discovery'
import { MistralService } from './mistral.service'
import { WEBSITE_EXTRACTION_PROMPT_V1 } from './prompts/website-extraction.v1'
import type {
  NormalizedFields,
  NormalizedContact,
  NormalizedVacancy,
  SourceHealth,
} from './types'

const MAX_TOTAL_TOKENS = 30_000

type MistralExtractResult = {
  company_name: string | null
  description_short: string | null
  address: { street?: string | null; number?: string | null; postcode?: string | null; city?: string | null } | null
  phones: string[]
  emails: string[]
  kvk_number: string | null
  social_media: {
    linkedin?: string | null
    instagram?: string | null
    tiktok?: string | null
    facebook?: string | null
    twitter?: string | null
  } | null
  contacts: Array<{
    name: string
    title: string | null
    email: string | null
    phone: string | null
    linkedin_url: string | null
    department_guess:
      | 'executive' | 'human_resources' | 'operations' | 'sales' | 'marketing' | 'other'
      | null
    source_page: string
  }>
  vacancies: Array<{ title: string; url: string | null; location: string | null }>
  blog_post_count: number | null
  blog_last_post_date: string | null
}

export class WebsiteServiceError extends Error {
  constructor(public reason: 'ssrf' | 'fetch_failed' | 'no_html' | 'mistral_failed' | 'unknown', message: string) {
    super(message)
    this.name = 'WebsiteServiceError'
  }
}

export class WebsiteService {
  private mistral = new MistralService()

  /**
   * Hoofdroute: fetch homepage + pages → markdown → Mistral → NormalizedFields.
   * `scrapeVacancies=true` → ook career-page fetchen + parsen.
   */
  async crawlAndParse(
    inputUrl: string,
    scrapeVacancies: boolean,
  ): Promise<NormalizedFields> {
    const homepageUrl = this.normalizeUrl(inputUrl)
    let home: { url: string; html: string }
    try {
      const r = await safeFetch(homepageUrl)
      if (r.status >= 400) {
        throw new WebsiteServiceError('fetch_failed', `Homepage ${r.status}: ${homepageUrl}`)
      }
      home = { url: r.url, html: r.body }
    } catch (e) {
      if (e instanceof SsrfBlockedError) throw new WebsiteServiceError('ssrf', e.message)
      if (e instanceof FetchSizeExceededError) throw new WebsiteServiceError('fetch_failed', e.message)
      if (e instanceof WebsiteServiceError) throw e
      throw new WebsiteServiceError('fetch_failed', e instanceof Error ? e.message : String(e))
    }

    if (!home.html.trim()) {
      throw new WebsiteServiceError('no_html', `Homepage levert lege body: ${homepageUrl}`)
    }

    const [info, career] = await Promise.all([
      discoverInfoPages(home.url),
      scrapeVacancies ? discoverCareerPage(home.url, home.html) : Promise.resolve(null),
    ])

    const pageDefs: Array<{ key: string; url: string }> = [{ key: 'homepage', url: home.url }]
    if (info.about) pageDefs.push({ key: 'over-ons', url: info.about })
    if (info.team) pageDefs.push({ key: 'team', url: info.team })
    if (info.contact) pageDefs.push({ key: 'contact', url: info.contact })
    if (info.services) pageDefs.push({ key: 'diensten', url: info.services })
    if (career && !career.external) pageDefs.push({ key: 'werkenbij', url: career.url })

    const fetched: Array<{ key: string; url: string; html: string }> = [
      { key: 'homepage', url: home.url, html: home.html },
    ]
    const others = pageDefs.filter((p) => p.key !== 'homepage')
    const results = await Promise.allSettled(
      others.map(async (p) => {
        const r = await safeFetch(p.url)
        return { key: p.key, url: r.url, html: r.body }
      }),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') fetched.push(r.value)
    }

    const pagesMd = fetched.map((p) => ({
      key: p.key,
      url: p.url,
      md: htmlToMarkdown(p.html),
    }))

    const combinedMd = pagesMd
      .map((p) => `## PAGINA: ${p.key} (${p.url})\n\n${p.md}`)
      .join('\n\n---\n\n')
    const truncated = truncateForLLM(combinedMd, MAX_TOTAL_TOKENS)

    let extracted: MistralExtractResult
    try {
      const userPrompt = WEBSITE_EXTRACTION_PROMPT_V1.replace('{markdown_per_page}', truncated)
      const r = await this.mistral.completeJson<MistralExtractResult>({
        systemPrompt: 'Je bent een data-extractor. Geef alleen geldig JSON terug.',
        userPrompt,
      })
      extracted = r.parsed
    } catch (e) {
      throw new WebsiteServiceError('mistral_failed', e instanceof Error ? e.message : String(e))
    }

    return this.mapToNormalized(home.url, pagesMd, extracted, career)
  }

  private normalizeUrl(input: string): string {
    let s = input.trim()
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`
    const u = new URL(s)
    u.hash = ''
    return u.toString()
  }

  private mapToNormalized(
    homepageUrl: string,
    pagesMd: Array<{ key: string; url: string; md: string }>,
    e: MistralExtractResult,
    career: Awaited<ReturnType<typeof discoverCareerPage>>,
  ): NormalizedFields {
    const contacts: NormalizedContact[] = (e.contacts ?? []).map((c) => ({
      name: c.name,
      title: c.title ?? undefined,
      email: c.email ?? undefined,
      phone_other: c.phone ?? undefined,
      linkedin_url: c.linkedin_url ?? undefined,
      department: c.department_guess ?? undefined,
      source_origin: ['website'],
    }))

    const vacancies: NormalizedVacancy[] = (e.vacancies ?? []).map((v) => ({
      title: v.title,
      url: v.url ?? undefined,
      location: v.location ?? undefined,
      source: 'website_werkenbij',
    }))

    const phones = (e.phones ?? []).filter(Boolean)
    const emails = (e.emails ?? []).filter(Boolean)

    return {
      company_name: e.company_name ?? undefined,
      kvk_number: e.kvk_number ?? undefined,
      address: e.address
        ? {
            street: e.address.street ?? undefined,
            number: e.address.number ?? undefined,
            postcode: e.address.postcode ?? undefined,
            city: e.address.city ?? undefined,
            country: 'Nederland',
          }
        : undefined,
      website: homepageUrl,
      email: emails[0],
      emails_all: emails.length ? emails : undefined,
      phone: phones[0],
      phones_all: phones.length ? phones : undefined,
      linkedin_url: e.social_media?.linkedin ?? undefined,
      twitter_url: e.social_media?.twitter ?? undefined,
      facebook_url: e.social_media?.facebook ?? undefined,
      instagram_url: e.social_media?.instagram ?? undefined,
      tiktok_url: e.social_media?.tiktok ?? undefined,
      description_short: e.description_short ?? undefined,
      pages_crawled: pagesMd.map((p) => ({
        path: new URL(p.url).pathname,
        title: p.key,
        word_count: wordCount(p.md),
      })),
      blog_post_count: e.blog_post_count ?? undefined,
      blog_last_post_date: e.blog_last_post_date ?? undefined,
      career_page_url: career?.url,
      career_page_method: career?.method,
      career_page_external: career?.external,
      career_page_ats_type: career?.ats_type,
      contacts: contacts.length ? contacts : undefined,
      vacancies: vacancies.length ? vacancies : undefined,
      source: 'website',
    }
  }

  async health(): Promise<SourceHealth> {
    const t0 = Date.now()
    try {
      const r = await safeFetch('https://example.com')
      return {
        ok: r.status === 200,
        latency_ms: Date.now() - t0,
        message: r.status === 200 ? undefined : `HTTP ${r.status}`,
      }
    } catch (e) {
      return {
        ok: false,
        latency_ms: Date.now() - t0,
        message: e instanceof Error ? e.message : String(e),
      }
    }
  }
}
