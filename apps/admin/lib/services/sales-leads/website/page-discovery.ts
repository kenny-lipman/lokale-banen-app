import { safeFetch } from './ssrf-fetch'

const ABOUT_PATHS = [
  '/over-ons', '/over', '/about', '/about-us', '/wie-zijn-wij',
]
const TEAM_PATHS = [
  '/team', '/ons-team', '/medewerkers', '/people',
]
const CONTACT_PATHS = [
  '/contact', '/contacteer-ons', '/contact-us',
]
const SERVICES_PATHS = [
  '/diensten', '/services', '/wat-we-doen', '/oplossingen',
]

async function findFirstHit(baseUrl: string, paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      const url = new URL(p, baseUrl).toString()
      const res = await safeFetch(url, { method: 'HEAD' })
      if (res.status >= 200 && res.status < 400) return url
    } catch {
      continue
    }
  }
  return null
}

export type DiscoveredPages = {
  about?: string
  team?: string
  contact?: string
  services?: string
}

/**
 * Vind /over-ons, /team, /contact, /diensten op homepage-domein.
 * Parallel HEAD-requests; eerste hit per categorie wint.
 */
export async function discoverInfoPages(homepageUrl: string): Promise<DiscoveredPages> {
  const [about, team, contact, services] = await Promise.all([
    findFirstHit(homepageUrl, ABOUT_PATHS),
    findFirstHit(homepageUrl, TEAM_PATHS),
    findFirstHit(homepageUrl, CONTACT_PATHS),
    findFirstHit(homepageUrl, SERVICES_PATHS),
  ])
  return {
    ...(about ? { about } : {}),
    ...(team ? { team } : {}),
    ...(contact ? { contact } : {}),
    ...(services ? { services } : {}),
  }
}
