import { safeFetch } from './ssrf-fetch'

export type CareerPageMethod = 'sitemap' | 'robots' | 'common_path' | 'html_link'

export type CareerPageResult = {
  url: string
  method: CareerPageMethod
  external: boolean
  ats_type?: string
}

const CAREER_PATH_KEYWORDS = [
  '/werkenbij', '/werken-bij', '/vacatures', '/vacature',
  '/careers', '/career', '/jobs', '/job',
  '/werken-bij-ons', '/jobs-careers', '/carriere',
  '/over-ons/vacatures', '/werken', '/team/vacatures',
]

const CAREER_KEYWORD_REGEX = /(werkenbij|werken-bij|vacatures?|careers?|jobs?|carrière|carriere)/i

const ATS_HOSTS: Array<{ host: RegExp; type: string }> = [
  { host: /(^|\.)greenhouse\.io$/, type: 'greenhouse' },
  { host: /(^|\.)lever\.co$/, type: 'lever' },
  { host: /(^|\.)personio\.com$/, type: 'personio' },
  { host: /(^|\.)workable\.com$/, type: 'workable' },
  { host: /(^|\.)recruitee\.com$/, type: 'recruitee' },
  { host: /(^|\.)homerun\.co$/, type: 'homerun' },
  { host: /(^|\.)teamtailor\.com$/, type: 'teamtailor' },
  { host: /(^|\.)bamboohr\.com$/, type: 'bamboohr' },
]

function detectAts(urlStr: string): { external: boolean; ats_type?: string } {
  try {
    const u = new URL(urlStr)
    for (const { host, type } of ATS_HOSTS) {
      if (host.test(u.hostname)) return { external: true, ats_type: type }
    }
    return { external: false }
  } catch {
    return { external: false }
  }
}

const SITEMAP_MAX_BYTES = 5 * 1024 * 1024
const SITEMAP_MAX_DEPTH = 3

async function fetchSitemapUrls(sitemapUrl: string, depth = 0): Promise<string[]> {
  if (depth >= SITEMAP_MAX_DEPTH) return []
  let body = ''
  try {
    const res = await safeFetch(sitemapUrl)
    if (res.bytes > SITEMAP_MAX_BYTES) return []
    body = res.body
  } catch {
    return []
  }
  if (/<sitemapindex/i.test(body)) {
    const subs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
    const all: string[] = []
    for (const s of subs.slice(0, 20)) {
      all.push(...(await fetchSitemapUrls(s, depth + 1)))
    }
    return all
  }
  return [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
}

async function tryFromSitemap(homepageUrl: string): Promise<CareerPageResult | null> {
  const sitemapUrl = new URL('/sitemap.xml', homepageUrl).toString()
  const urls = await fetchSitemapUrls(sitemapUrl)
  const hit = urls.find((u) => CAREER_KEYWORD_REGEX.test(u))
  if (!hit) return null
  return { url: hit, method: 'sitemap', ...detectAts(hit) }
}

async function tryFromRobots(homepageUrl: string): Promise<CareerPageResult | null> {
  try {
    const robotsUrl = new URL('/robots.txt', homepageUrl).toString()
    const res = await safeFetch(robotsUrl)
    const sitemaps = [...res.body.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map((m) => m[1])
    for (const sm of sitemaps) {
      const urls = await fetchSitemapUrls(sm)
      const hit = urls.find((u) => CAREER_KEYWORD_REGEX.test(u))
      if (hit) return { url: hit, method: 'robots', ...detectAts(hit) }
    }
  } catch {}
  return null
}

async function tryCommonPaths(homepageUrl: string): Promise<CareerPageResult | null> {
  for (const p of CAREER_PATH_KEYWORDS) {
    try {
      const url = new URL(p, homepageUrl).toString()
      const res = await safeFetch(url, { method: 'HEAD' })
      if (res.status >= 200 && res.status < 400) {
        return { url, method: 'common_path', ...detectAts(url) }
      }
    } catch {
      continue
    }
  }
  return null
}

async function tryHtmlLink(homepageUrl: string, homepageHtml: string): Promise<CareerPageResult | null> {
  const linkRegex = /<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const sameDomain = new URL(homepageUrl).hostname.replace(/^www\./, '')
  for (const m of homepageHtml.matchAll(linkRegex)) {
    const href = m[1]
    const text = m[2].replace(/<[^>]+>/g, ' ').trim()
    if (!CAREER_KEYWORD_REGEX.test(text)) continue
    let abs: URL
    try {
      abs = new URL(href, homepageUrl)
    } catch {
      continue
    }
    const hostStripped = abs.hostname.replace(/^www\./, '')
    if (hostStripped !== sameDomain) {
      const ats = detectAts(abs.toString())
      if (ats.external) return { url: abs.toString(), method: 'html_link', ...ats }
      continue
    }
    return { url: abs.toString(), method: 'html_link', ...detectAts(abs.toString()) }
  }
  return null
}

/**
 * Probeer in volgorde: sitemap → robots → common paths → HTML link-detection.
 */
export async function discoverCareerPage(
  homepageUrl: string,
  homepageHtml: string,
): Promise<CareerPageResult | null> {
  return (
    (await tryFromSitemap(homepageUrl)) ??
    (await tryFromRobots(homepageUrl)) ??
    (await tryCommonPaths(homepageUrl)) ??
    (await tryHtmlLink(homepageUrl, homepageHtml))
  )
}
