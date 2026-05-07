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

// Eerste-match-wint, geordend op specificiteit (specifieke patterns voor algemene).
// Voor 'careers' is een ruime regex preferent: Mistral kan non-relevante content
// negeren; missen van een werken-bij pagina kost vacancies-data.
const ROLE_RULES: Array<{ re: RegExp; role: DiscoveredUrlRole; priority: number }> = [
  // CONTACT
  { re: /\/contact(?:[\/\-_]|$|\.)/i, role: 'contact', priority: 0 },

  // ABOUT (Dutch + English variants)
  { re: /\/(?:over[-_]?ons|over)(?:[\/\-_]|$|\.)/i, role: 'about', priority: 1 },
  { re: /\/about(?:[-_]?us)?(?:[\/\-_]|$|\.)/i, role: 'about', priority: 1 },
  { re: /\/(?:wie[-_]?(?:we[-_]?zijn|zijn[-_]?we))(?:[\/\-_]|$|\.)/i, role: 'about', priority: 1 },
  { re: /\/who[-_]?we[-_]?are(?:[\/\-_]|$|\.)/i, role: 'about', priority: 1 },

  // TEAM
  { re: /\/(?:team|ons[-_]?team|medewerkers|mensen|people|our[-_]?team)(?:[\/\-_]|$|\.)/i, role: 'team', priority: 2 },

  // CAREERS — ruim, NL + EN + variantvormen
  {
    // NL careers
    re: /\/(?:werken[-_]?bij|werk[-_]?bij|werk[-_]?(?:met|bij)[-_]?ons|bij[-_]?ons[-_]?werken|werkenbij)(?:[\/\-_]|$|\.)/i,
    role: 'careers',
    priority: 3,
  },
  {
    // NL vacatures + variants
    re: /\/(?:vacatures?|openstaande[-_]?vacatures?|vacature[-_]?overzicht)(?:[\/\-_]|$|\.)/i,
    role: 'careers',
    priority: 3,
  },
  {
    // EN careers/jobs
    re: /\/(?:carri[èe]re?s?|careers?|jobs?|join[-_]?(?:us|our[-_]?team)?|hire(?:[-_]?us)?|work[-_]?(?:with|for|at)[-_]?us|opportunities)(?:[\/\-_]|$|\.)/i,
    role: 'careers',
    priority: 3,
  },
  {
    // ATS-paths (komen vaak terug in zowel sitemap als links)
    re: /\/(?:greenhouse|lever|workable|bamboohr|recruitee|homerun|teamtailor|personio|jobvite)(?:[\/\-_]|$|\.)/i,
    role: 'careers',
    priority: 3,
  },

  // COMPANY
  { re: /\/(?:bedrijf|company|organisatie|organization)(?:[\/\-_]|$|\.)/i, role: 'company', priority: 4 },
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

/**
 * Wrapt safeFetch: returnt body + finalUrl (na redirects), of null bij niet-2xx.
 * Caller heeft finalUrl nodig om relative sitemap-paden uit robots.txt correct
 * te resolven (bv. wetarget.nl → www.wetarget.nl redirect).
 */
async function fetchTextWithUrl(
  url: string,
): Promise<{ body: string; finalUrl: string } | null> {
  try {
    const r = await safeFetch(url)
    if (r.status >= 200 && r.status < 300) return { body: r.body, finalUrl: r.url }
    return null
  } catch {
    return null
  }
}

/**
 * Resolve raw sitemap-string (kan relatief zijn, "/sitemap.xml") tegen baseUrl.
 * Returnt null wanneer URL niet parsebaar is.
 */
function resolveSitemapUrl(raw: string, baseUrl: string): string | null {
  try {
    return new URL(raw, baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * Hoofdroute: vind sitemap-URLs voor input domain en return top-N gescoorde URLs.
 *
 * Volgorde:
 * 1. /robots.txt → Sitemap: regels (relative paths worden geresolved tegen
 *    de finale URL van de robots.txt fetch — vital voor sites met www-redirect)
 * 2. /sitemap.xml + /sitemap_index.xml als fallback wanneer robots geen geldige
 *    sitemap-entries gaf
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

  // 1. robots.txt — kan zelf redirecten (bv. wetarget.nl → www.wetarget.nl)
  const robotsResult = await fetchTextWithUrl(`${origin}/robots.txt`)
  if (robotsResult) {
    const rawSitemaps = parseRobotsForSitemaps(robotsResult.body)
    for (const raw of rawSitemaps) {
      const resolved = resolveSitemapUrl(raw, robotsResult.finalUrl)
      if (resolved) sitemapCandidates.push(resolved)
    }
  }

  // 2. Fallback: standaard locaties wanneer robots geen geldige sitemap gaf
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

  const result = await fetchTextWithUrl(sitemapUrl)
  if (!result) return
  const { urls, childSitemaps } = parseSitemapXml(result.body)
  for (const u of urls) {
    if (collected.size >= MAX_DISCOVERY_URLS) break
    collected.add(u)
  }
  // Child-sitemap loc-elementen kunnen ook relatief zijn — resolve tegen parent.
  const resolvedChildren = childSitemaps
    .map((cs) => resolveSitemapUrl(cs, result.finalUrl))
    .filter((u): u is string => !!u)
  await Promise.all(
    resolvedChildren.map((cs) => collectFromSitemap(cs, collected, visited, depth + 1)),
  )
}
