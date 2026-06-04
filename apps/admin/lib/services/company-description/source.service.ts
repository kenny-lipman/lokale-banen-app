/**
 * Company Description Source Service
 *
 * Verzamelt bron-materiaal voor de AI-bedrijfsomschrijving: de "over ons"-tekst
 * van de bedrijfswebsite (hergebruik van de sales-leads website-infra) plus de
 * vacaturetitels van het bedrijf. Faalt zacht: als de website niet bereikbaar is
 * blijft websiteText null en wordt alleen op vacatures teruggevallen.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { safeFetch } from '@/lib/services/sales-leads/website/ssrf-fetch'
import { htmlToMarkdown, truncateForLLM } from '@/lib/services/sales-leads/website/markdown'
import {
  discoverUrls,
  type DiscoveredUrl,
} from '@/lib/services/sales-leads/website/sitemap-discovery'

export interface CompanySource {
  websiteText: string | null
  websiteUrl: string | null
  vacancyTitles: string[]
}

const MAX_VACANCY_TITLES = 25
const SOURCE_MAX_TOKENS = 1500

/**
 * Kies de meest geschikte bron-URL: 'about' > 'home' > de opgegeven website.
 * Pure functie zodat de selectie-logica los te testen is.
 */
export function pickSourceUrl(
  discovered: DiscoveredUrl[],
  fallbackWebsite: string,
): string | null {
  const about = discovered.find((d) => d.role === 'about')
  if (about) return about.url
  const home = discovered.find((d) => d.role === 'home')
  if (home) return home.url
  return fallbackWebsite || null
}

async function fetchWebsiteText(
  website: string | null,
): Promise<{ text: string | null; url: string | null }> {
  if (!website) return { text: null, url: null }
  const w = website.trim()
  if (!w) return { text: null, url: null }
  const normalized = w.startsWith('http') ? w : `https://${w}`
  try {
    const discovered = await discoverUrls(normalized)
    const target = pickSourceUrl(discovered, normalized)
    if (!target) return { text: null, url: null }
    const res = await safeFetch(target)
    if (res.status >= 400 || !res.contentType.includes('html')) {
      return { text: null, url: null }
    }
    const md = htmlToMarkdown(res.body)
    const text = truncateForLLM(md, SOURCE_MAX_TOKENS).trim()
    return { text: text.length > 0 ? text : null, url: res.url }
  } catch {
    // SSRF-block, timeout, size-limit, DNS-fail: zacht falen, val terug op vacatures
    return { text: null, url: null }
  }
}

async function fetchVacancyTitles(
  supabase: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('job_postings')
    .select('title')
    .eq('company_id', companyId)
    .not('title', 'is', null)
    .order('created_at', { ascending: false })
    .limit(MAX_VACANCY_TITLES)

  if (!data) return []

  const seen = new Set<string>()
  const titles: string[] = []
  for (const row of data as Array<{ title: string | null }>) {
    const t = (row.title ?? '').trim()
    if (t && !seen.has(t)) {
      seen.add(t)
      titles.push(t)
    }
  }
  return titles
}

export async function fetchCompanySource(
  supabase: SupabaseClient,
  params: { companyId: string; website: string | null },
): Promise<CompanySource> {
  const [{ text, url }, vacancyTitles] = await Promise.all([
    fetchWebsiteText(params.website),
    fetchVacancyTitles(supabase, params.companyId),
  ])
  return { websiteText: text, websiteUrl: url, vacancyTitles }
}
