import { SsrfBlockedError, FetchSizeExceededError } from './website/ssrf-fetch'
import { htmlToMarkdown, truncateForLLM, wordCount } from './website/markdown'
import { discoverUrls, type DiscoveredUrl } from './website/sitemap-discovery'
import { tieredFetch, type FetchTier } from './website/tiered-fetch'
import { PlaywrightFetcher } from './website/playwright-fetcher'
import { MistralService } from './mistral.service'
import { WEBSITE_EXTRACTION_PROMPT_V1 } from './prompts/website-extraction.v1'
import type {
  NormalizedFields,
  NormalizedContact,
  NormalizedVacancy,
  SourceHealth,
} from './types'

const MAX_TOTAL_TOKENS = 30_000
const MAX_PAGES = 6

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
  constructor(
    public reason: 'ssrf' | 'fetch_failed' | 'no_html' | 'mistral_failed' | 'homepage_blocked' | 'unknown',
    message: string,
  ) {
    super(message)
    this.name = 'WebsiteServiceError'
  }
}

type FetchedPage = {
  url: string
  role: DiscoveredUrl['role']
  tier: FetchTier
  blocked: boolean
  markdown: string
}

export class WebsiteService {
  private mistral = new MistralService()

  /**
   * Hoofdroute: sitemap-discovery → top-N URLs → tiered-fetch (ssrf-fetch met
   * Playwright fallback) → markdown → Mistral → NormalizedFields.
   *
   * Gooit `WebsiteServiceError('homepage_blocked')` wanneer alle pagina's door
   * anti-bot worden geblokkeerd, ook na Playwright-escalatie.
   */
  async crawlAndParse(inputUrl: string, _scrapeVacancies: boolean): Promise<NormalizedFields> {
    const homepageUrl = this.normalizeUrl(inputUrl)
    const playwright = new PlaywrightFetcher()
    try {
      await playwright.init()

      const discovered = await discoverUrls(homepageUrl)
      const targets: DiscoveredUrl[] =
        discovered.length > 0
          ? discovered.slice(0, MAX_PAGES)
          : [{ url: homepageUrl, role: 'home', priority: 0 }]

      // Sequentieel om browser-context-druk laag te houden + per-URL timing
      // duidelijk te kunnen loggen in audit.
      const fetched: FetchedPage[] = []
      for (const t of targets) {
        try {
          const r = await tieredFetch(t.url, playwright)
          fetched.push({
            url: r.finalUrl,
            role: t.role,
            tier: r.tier,
            blocked: r.blocked,
            markdown: r.blocked ? '' : htmlToMarkdown(r.html),
          })
        } catch (e) {
          if (e instanceof SsrfBlockedError) {
            // SSRF-fail per URL: skip, laat andere URLs door
            fetched.push({ url: t.url, role: t.role, tier: 1, blocked: true, markdown: '' })
            continue
          }
          if (e instanceof FetchSizeExceededError) {
            fetched.push({ url: t.url, role: t.role, tier: 1, blocked: true, markdown: '' })
            continue
          }
          // Onbekende fout per URL: skip
          fetched.push({ url: t.url, role: t.role, tier: 2, blocked: true, markdown: '' })
        }
      }

      const usable = fetched.filter((f) => !f.blocked && f.markdown.length > 200)
      if (usable.length === 0) {
        const allBlocked = fetched.length > 0 && fetched.every((f) => f.blocked)
        throw new WebsiteServiceError(
          allBlocked ? 'homepage_blocked' : 'no_html',
          allBlocked
            ? `Anti-bot blokkeert alle ${fetched.length} pagina's van ${homepageUrl}`
            : `Geen bruikbare content op ${homepageUrl}`,
        )
      }

      const combinedMd = usable
        .map((p) => `## PAGINA: ${p.role} (${p.url})\n\n${p.markdown}`)
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

      return this.mapToNormalized(homepageUrl, usable, extracted)
    } finally {
      await playwright.dispose()
    }
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
    pages: FetchedPage[],
    e: MistralExtractResult,
  ): NormalizedFields {
    // Mistral kan contacten met null name terugleveren — die zijn onbruikbaar
    // (geen identiteit voor dedup of ranking). Filter ze hier weg.
    const contacts: NormalizedContact[] = (e.contacts ?? [])
      .filter((c): c is typeof c & { name: string } => typeof c.name === 'string' && c.name.trim().length > 0)
      .map((c) => ({
        name: c.name,
        title: c.title ?? undefined,
        email: c.email ?? undefined,
        phone_other: c.phone ?? undefined,
        linkedin_url: c.linkedin_url ?? undefined,
        department: c.department_guess ?? undefined,
        source_origin: ['website'],
      }))

    const vacancies: NormalizedVacancy[] = (e.vacancies ?? [])
      .filter((v): v is typeof v & { title: string } => typeof v.title === 'string' && v.title.trim().length > 0)
      .map((v) => ({
        title: v.title,
        url: v.url ?? undefined,
        location: v.location ?? undefined,
        source: 'website_werkenbij',
      }))

    const phones = (e.phones ?? []).filter(Boolean)
    const emails = (e.emails ?? []).filter(Boolean)

    // Career-page = eerste discovered URL met role='careers' die we ook
    // daadwerkelijk hebben kunnen ophalen. Method 'sitemap' want we ontdekken
    // uitsluitend via sitemap nu.
    const careerPage = pages.find((p) => p.role === 'careers')

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
      pages_crawled: pages.map((p) => ({
        path: safePathname(p.url),
        title: `${p.role}${p.tier === 2 ? ' [pw]' : ''}`,
        word_count: wordCount(p.markdown),
      })),
      blog_post_count: e.blog_post_count ?? undefined,
      blog_last_post_date: e.blog_last_post_date ?? undefined,
      career_page_url: careerPage?.url,
      career_page_method: careerPage ? 'sitemap' : undefined,
      contacts: contacts.length ? contacts : undefined,
      vacancies: vacancies.length ? vacancies : undefined,
      source: 'website',
    }
  }

  async health(): Promise<SourceHealth> {
    const t0 = Date.now()
    try {
      const { safeFetch } = await import('./website/ssrf-fetch')
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

function safePathname(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return '/'
  }
}
