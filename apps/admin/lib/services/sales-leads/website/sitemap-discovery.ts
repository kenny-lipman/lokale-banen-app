import { safeFetch } from './ssrf-fetch'

export type DiscoveredUrlRole =
  | 'home'
  | 'contact'
  | 'about'
  | 'team'
  | 'careers'
  | 'company'
  | 'other'

export type DiscoveredUrl = {
  url: string
  role: DiscoveredUrlRole
  priority: number // 0 = highest
}

const MAX_DISCOVERY_URLS = 500
const MAX_RECURSION_DEPTH = 2
const TOP_N = 12

const ROLE_RULES: Array<{ re: RegExp; role: DiscoveredUrlRole; priority: number }> = [
  { re: /\/contact(?:[\/\-_]|$|\.)/i, role: 'contact', priority: 0 },
  { re: /\/(?:over[-_]?ons|over)(?:[\/\-_]|$|\.)/i, role: 'about', priority: 1 },
  { re: /\/about(?:[-_]?us)?(?:[\/\-_]|$|\.)/i, role: 'about', priority: 1 },
  { re: /\/(?:team|medewerkers|mensen|people)(?:[\/\-_]|$|\.)/i, role: 'team', priority: 2 },
  {
    re: /\/(?:werken[-_]?bij|carrieres?|careers?|jobs?|vacatures?)(?:[\/\-_]|$|\.)/i,
    role: 'careers',
    priority: 3,
  },
  { re: /\/(?:bedrijf|company|organisatie)(?:[\/\-_]|$|\.)/i, role: 'company', priority: 4 },
]

/**
 * Parse `Sitemap:` regels uit robots.txt. RFC 9309 §2.5.
 */
export function parseRobotsForSitemaps(robotsText: string): string[] {
  const out: string[] = []
  for (const line of robotsText.split(/\r?\n/)) {
    const m = line.match(/^\s*sitemap\s*:\s*(\S+)/i)
    if (m && m[1]) out.push(m[1].trim())
  }
  return Array.from(new Set(out))
}

/**
 * Naïeve XML-parse zonder externe dep — voldoende voor sitemap.xml en sitemap_index.xml.
 * Returnt urls (uit <url><loc>) én childSitemaps (uit <sitemap><loc>) zodat caller
 * recursief kan dalen.
 */
export function parseSitemapXml(xml: string): { urls: string[]; childSitemaps: string[] } {
  const urls: string[] = []
  const childSitemaps: string[] = []

  // Block <sitemap>...<loc>...</loc>...</sitemap> = index-entry
  const sitemapBlockRe = /<sitemap\b[\s\S]*?<\/sitemap>/gi
  let block: RegExpExecArray | null
  while ((block = sitemapBlockRe.exec(xml))) {
    const locMatch = block[0].match(/<loc>\s*([^<]+?)\s*<\/loc>/i)
    if (locMatch && locMatch[1]) childSitemaps.push(decodeXmlEntities(locMatch[1].trim()))
  }

  // Block <url>...<loc>...</loc>...</url> = pagina-entry
  const urlBlockRe = /<url\b[\s\S]*?<\/url>/gi
  while ((block = urlBlockRe.exec(xml))) {
    const locMatch = block[0].match(/<loc>\s*([^<]+?)\s*<\/loc>/i)
    if (locMatch && locMatch[1]) urls.push(decodeXmlEntities(locMatch[1].trim()))
  }

  return { urls: Array.from(new Set(urls)), childSitemaps: Array.from(new Set(childSitemaps)) }
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Score een URL op basis van pad-keywords. Eerste match wint (rules zijn priority-geordend).
 * Returnt fallback role='other', priority=10 als niets matcht.
 */
export function scoreUrl(url: string): { role: DiscoveredUrlRole; priority: number } {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return { role: 'other', priority: 10 }
  }
  // Homepage detecteren — meestal geen path of slechts taal-prefix.
  if (path === '/' || /^\/(?:nl|en|de|fr)\/?$/i.test(path)) {
    return { role: 'home', priority: 0 }
  }
  for (const rule of ROLE_RULES) {
    if (rule.re.test(path)) return { role: rule.role, priority: rule.priority }
  }
  // Diepere paden krijgen lagere prio (priority hoger = minder belangrijk).
  const depth = path.split('/').filter(Boolean).length
  return { role: 'other', priority: 10 + depth }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await safeFetch(url)
    if (r.status >= 200 && r.status < 300) return r.body
    return null
  } catch {
    return null
  }
}

/**
 * Hoofdroute: vind sitemap-URLs voor input domain en return top-N gescoorde URLs.
 *
 * Volgorde:
 * 1. /robots.txt → Sitemap: regels
 * 2. /sitemap.xml + /sitemap_index.xml als fallback
 * 3. Recursief sitemap-index parsen (max diepte 2)
 * 4. Score + dedupe + return top-12
 */
export async function discoverUrls(inputUrl: string): Promise<DiscoveredUrl[]> {
  let origin: string
  try {
    origin = new URL(inputUrl).origin
  } catch {
    return []
  }

  const sitemapCandidates: string[] = []

  // 1. robots.txt
  const robotsBody = await fetchText(`${origin}/robots.txt`)
  if (robotsBody) {
    sitemapCandidates.push(...parseRobotsForSitemaps(robotsBody))
  }

  // 2. Default locaties als fallback
  if (sitemapCandidates.length === 0) {
    sitemapCandidates.push(`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`)
  }

  // 3. Recursief parsen
  const collectedUrls = new Set<string>()
  const visitedSitemaps = new Set<string>()
  await Promise.all(
    sitemapCandidates.map((sm) =>
      collectFromSitemap(sm, collectedUrls, visitedSitemaps, /* depth */ 0),
    ),
  )

  // Soft-cap zodat parsing niet ontspoort op 50k-URL sitemaps
  const allUrls = Array.from(collectedUrls).slice(0, MAX_DISCOVERY_URLS)

  // Score + sort + top-N
  const scored: DiscoveredUrl[] = allUrls.map((u) => ({ url: u, ...scoreUrl(u) }))
  scored.sort((a, b) => a.priority - b.priority)
  return scored.slice(0, TOP_N)
}

async function collectFromSitemap(
  sitemapUrl: string,
  collected: Set<string>,
  visited: Set<string>,
  depth: number,
): Promise<void> {
  if (depth > MAX_RECURSION_DEPTH) return
  if (visited.has(sitemapUrl)) return
  visited.add(sitemapUrl)
  if (collected.size >= MAX_DISCOVERY_URLS) return

  const body = await fetchText(sitemapUrl)
  if (!body) return
  const { urls, childSitemaps } = parseSitemapXml(body)
  for (const u of urls) {
    if (collected.size >= MAX_DISCOVERY_URLS) break
    collected.add(u)
  }
  await Promise.all(
    childSitemaps.map((cs) => collectFromSitemap(cs, collected, visited, depth + 1)),
  )
}
