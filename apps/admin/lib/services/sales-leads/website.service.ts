import { SsrfBlockedError, FetchSizeExceededError, safeFetch } from './website/ssrf-fetch'
import { htmlToMarkdown, truncateForLLM, wordCount } from './website/markdown'
import { discoverUrls, selectTargetsByRole, type DiscoveredUrl } from './website/sitemap-discovery'
import { tieredFetch, type FetchTier } from './website/tiered-fetch'
import { PlaywrightFetcher } from './website/playwright-fetcher'
import { MistralService } from './mistral.service'
import { isPlaceholderContactName } from './contact-filters'
import { WEBSITE_EXTRACTION_PROMPT_V1 } from './prompts/website-extraction.v1'
import { normalizeUrl } from '@/lib/utils/url'
import { detectAts } from './ats-detect'
import type {
  CareerPageMethod,
  NormalizedFields,
  NormalizedContact,
  NormalizedVacancy,
  SourceHealth,
} from './types'

/**
 * Extracteert "registrable" apex (laatste 2 labels van hostname).
 * Werkt voor `.com`, `.nl`, `.de`. NIET voor multi-label TLDs zoals `.co.uk`.
 * Voor NL B2B (huidige scope) is dat acceptabel.
 */
function extractApex(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.')
  if (parts.length <= 2) return parts.join('.')
  return parts.slice(-2).join('.')
}

/**
 * V1A.1 filter: accepteer een Mistral-extracted career-URL alleen als hij
 * (a) op hetzelfde apex-domain als de homepage staat, of
 * (b) een herkend ATS-platform is (recruitee/greenhouse/...).
 *
 * Anders: skip — Mistral kan LinkedIn/Indeed/etc. URLs teruggeven die we
 * niet als auto-approved career-source willen aanmaken.
 */
function isAcceptableCareerUrl(url: string, homepageApex: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  if (extractApex(host) === homepageApex) return true
  if (detectAts(url)) return true
  return false
}

type CareerCandidate = { url: string; method: CareerPageMethod; role: 'careers' }

/**
 * Dedupe career-page candidates op canonical URL. Behoudt eerste-match-method
 * (volgorde caller bepaalt prioriteit: html_link > sitemap > subdomain_probe).
 */
// Cloudflare Email Protection rendert "[email protected]" als placeholder in HTML
// (decode-via-JS). Mistral leest de placeholder als platte tekst en zet hem
// als email. Non-breaking space U+00A0 of normale spatie zit tussen "email" en
// "protected"; regex matched beide. Filtert silent zodat de info@-fallback in
// pipedrive-payloads alsnog gebruikt wordt.
const CLOUDFLARE_EMAIL_PLACEHOLDER_RE = /^\[email[\s ]*protected\]$/i

function sanitizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (CLOUDFLARE_EMAIL_PLACEHOLDER_RE.test(trimmed)) {
    console.warn('[website.service] Cloudflare email-placeholder gefilterd:', raw)
    return null
  }
  return trimmed
}

function mergeCareerCandidates(input: Array<{ url: string; method: CareerPageMethod }>): CareerCandidate[] {
  const seen = new Set<string>()
  const out: CareerCandidate[] = []
  for (const item of input) {
    const canon = normalizeUrl(item.url)
    if (!canon || seen.has(canon)) continue
    seen.add(canon)
    out.push({ url: canon, method: item.method, role: 'careers' })
  }
  return out
}

const MAX_TOTAL_TOKENS = 30_000
const MAX_PAGES = 50
const FETCH_CONCURRENCY = 5

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
  career_page_urls?: string[]
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
  url: string            // finalUrl ná eventuele redirects (gebruikt in Mistral-prompt)
  originalUrl: string    // url waarmee we tieredFetch aanriepen (= sitemap-URL); voor pages_discovered mapping
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
    // Lazy init: PlaywrightFetcher start Chromium pas wanneer fetchPage wordt
    // aangeroepen (Tier-2 escalatie). Bij Shopify/WordPress/SSR-sites blijft
    // de browser uit, wat ETXTBSY-race voorkomt én cold-start CPU bespaart.
    const playwright = new PlaywrightFetcher()
    try {
      const discovered = await discoverUrls(homepageUrl)
      const targets: DiscoveredUrl[] =
        discovered.length > 0
          ? selectTargetsByRole(discovered, MAX_PAGES)
          : [{ url: homepageUrl, role: 'home', priority: 0 }]

      // Concurrent fetch met cap van FETCH_CONCURRENCY. PlaywrightFetcher is
      // safe voor parallelle aanroepen (elke fetchPage opent eigen context).
      // Order van targets behouden door indexed-result map zodat de Mistral-
      // prompt home-first ziet.
      const fetched = await mapConcurrent(targets, FETCH_CONCURRENCY, async (t): Promise<FetchedPage> => {
        try {
          const r = await tieredFetch(t.url, playwright)
          return {
            url: r.finalUrl,
            originalUrl: t.url,
            role: t.role,
            tier: r.tier,
            blocked: r.blocked,
            markdown: r.blocked ? '' : htmlToMarkdown(r.html),
          }
        } catch (e) {
          if (e instanceof SsrfBlockedError || e instanceof FetchSizeExceededError) {
            return { url: t.url, originalUrl: t.url, role: t.role, tier: 1, blocked: true, markdown: '' }
          }
          return { url: t.url, originalUrl: t.url, role: t.role, tier: 2, blocked: true, markdown: '' }
        }
      })

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

      const normalized = this.mapToNormalized(homepageUrl, usable, extracted, discovered)

      // V1A.1 trap 3: subdomain-probe als trap 1+2 niets opleverde.
      // Cheap (4× HEAD parallel) en alleen wanneer nodig.
      if (!normalized.career_page_candidates || normalized.career_page_candidates.length === 0) {
        const probed = await this.probeSubdomains(homepageUrl)
        if (probed.length > 0) {
          normalized.career_page_candidates = probed
        }
      }
      return normalized
    } finally {
      await playwright.dispose()
    }
  }

  /**
   * V1A.1 trap 3: probe common career-subdomains parallel via HEAD.
   * Filtert weg: redirects naar het root-domain (telt als false-positive,
   * want de subdomain bestaat niet echt — DNS catch-all).
   */
  private async probeSubdomains(homepageUrl: string): Promise<CareerCandidate[]> {
    let host: string
    try {
      host = new URL(homepageUrl).hostname.replace(/^www\./i, '')
    } catch {
      return []
    }
    const subdomains = ['careers', 'werkenbij', 'jobs', 'vacatures']
    const probes = subdomains.map(async (sub): Promise<CareerCandidate | null> => {
      const url = `https://${sub}.${host}`
      try {
        const r = await safeFetch(url, { method: 'HEAD' })
        if (r.status < 200 || r.status >= 400) return null
        // Verwerp redirect naar root-domain (DNS catch-all kan elk subdomain naar
        // homepage sturen — dat is geen echte career-subsite).
        const finalHost = new URL(r.url).hostname.replace(/^www\./i, '')
        if (finalHost === host) return null
        // Gebruik finalUrl (na redirects) voor canonical zodat jobs.x → careers.x
        // de-dupliceert in mergeCareerCandidates downstream.
        return { url: normalizeUrl(r.url) ?? r.url, method: 'subdomain_probe', role: 'careers' }
      } catch {
        return null
      }
    })
    const results = await Promise.allSettled(probes)
    const raw: Array<{ url: string; method: CareerPageMethod }> = []
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) raw.push({ url: r.value.url, method: r.value.method })
    }
    return mergeCareerCandidates(raw)
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
    discovered: DiscoveredUrl[],
  ): NormalizedFields {
    // Mistral kan contacten met null name terugleveren — drop die. Voor
    // placeholder-namen ("Niet gespecificeerd", "Niet expliciet genoemd",
    // etc.) normaliseren we naar "Afdeling Personeelszaken" zodat user de
    // contact-record in de UI kan editen i.p.v. opnieuw moet aanmaken.
    // Email/phone/department blijven behouden — alleen de naam is fallback.
    const contacts: NormalizedContact[] = (e.contacts ?? [])
      .filter((c): c is typeof c & { name: string } =>
        typeof c.name === 'string' && c.name.trim().length > 0,
      )
      .map((c) => {
        const isPlaceholder = isPlaceholderContactName(c.name)
        const name = isPlaceholder ? 'Afdeling Personeelszaken' : c.name
        // Mobiel-detectie via prefix na whitespace-strip: 06, +316, 0031 6.
        // Website-scrape levert alleen ééne `phone` per contact (geen type),
        // daarom hier classificeren zodat sync-flow consistent met Apollo werkt
        // (mobile-first, dan vast).
        const phone = c.phone?.trim() ?? null
        const isMobile = phone ? /^(\+?316|00316|06)/.test(phone.replace(/\s+/g, '')) : false
        return {
          name,
          first_name: isPlaceholder ? 'Afdeling Personeelszaken' : undefined,
          last_name: isPlaceholder ? '' : undefined,
          title: c.title ?? undefined,
          email: sanitizeEmail(c.email) ?? undefined,
          phone_mobile: isMobile ? phone ?? undefined : undefined,
          phone_other: isMobile ? undefined : phone ?? undefined,
          linkedin_url: c.linkedin_url ?? undefined,
          department: c.department_guess ?? undefined,
          source_origin: ['website'],
        }
      })

    const vacancies: NormalizedVacancy[] = (e.vacancies ?? [])
      .filter((v): v is typeof v & { title: string } => typeof v.title === 'string' && v.title.trim().length > 0)
      .map((v) => ({
        title: v.title,
        url: v.url ?? undefined,
        location: v.location ?? undefined,
        source: 'website_werkenbij',
      }))

    const phones = (e.phones ?? []).filter(Boolean)
    const emails = (e.emails ?? [])
      .map((raw) => sanitizeEmail(raw))
      .filter((v): v is string => !!v)

    // Career-page = eerste discovered URL met role='careers' die we ook
    // daadwerkelijk hebben kunnen ophalen. Method 'sitemap' want we ontdekken
    // uitsluitend via sitemap nu.
    const careerPage = pages.find((p) => p.role === 'careers')

    // V1A.1 cascade: merge candidates uit Mistral (homepage-link extraction)
    // en sitemap-discovery. Dedupe via canonical URL.
    // Mistral-URLs worden gefilterd op same-apex of ATS — zonder filter zou
    // Mistral LinkedIn/Indeed-URLs als auto-approved career-source aanmaken.
    // Trap 3 (subdomain-probe) wordt elders aangeroepen wanneer dit leeg blijft.
    const homepageApex = extractApex(new URL(homepageUrl).hostname)
    const acceptableMistralUrls = (e.career_page_urls ?? []).filter((url) =>
      isAcceptableCareerUrl(url, homepageApex),
    )
    const careerCandidates = mergeCareerCandidates([
      ...acceptableMistralUrls.map((url) => ({ url, method: 'html_link' as const })),
      ...discovered
        .filter((d) => d.role === 'careers')
        .map((d) => ({ url: d.url, method: 'sitemap' as const })),
    ])

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
        role: p.role,
      })),
      // Volledige sitemap-discovery met fetched-flag — UI toont gecrawled
      // vs alleen-gevonden voor transparency. Helpt bij verifiëren of
      // belangrijke URLs zijn meegenomen of weggevallen door de role-caps.
      pages_discovered: discovered.length
        ? discovered.map((d) => ({
            path: safePathname(d.url),
            role: d.role,
            priority: d.priority,
            // Match op originalUrl: sites kunnen 301-redirecten (vacatures-X →
            // vacatures-overview) waardoor finalUrl afwijkt van de sitemap-URL.
            // Zonder deze check zou een gefetchte page als 'niet gecrawled' tonen.
            fetched: pages.some((p) => p.originalUrl === d.url || p.url === d.url),
          }))
        : undefined,
      blog_post_count: e.blog_post_count ?? undefined,
      blog_last_post_date: e.blog_last_post_date ?? undefined,
      career_page_url: careerPage?.url,
      career_page_method: careerPage ? 'sitemap' : undefined,
      career_page_candidates: careerCandidates.length ? careerCandidates : undefined,
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

/**
 * Concurrency-limited map die de input-volgorde van `items` behoudt in de output.
 * Houdt altijd `limit` workers in flight (rolling concurrency, niet batched per
 * groep van N) — zodra een fetch klaar is start de volgende. `fn` mag zelf
 * gooien; we vangen niet hier, dat is callers verantwoordelijkheid.
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}
