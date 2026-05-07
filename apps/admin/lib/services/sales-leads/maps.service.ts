import { runActorSync, ApifyApiError } from '@/lib/services/apify/run-actor-sync'
import { cachedFetch } from './cache'
import type { NormalizedFields, SourceHealth } from './types'

// compass/crawler-google-places output schema (subset — alleen velden die we mappen).
type ApifyGoogleMapsItem = {
  title: string
  placeId: string
  address: string | null
  street: string | null
  city: string | null
  postalCode: string | null
  state: string | null
  countryCode: string | null
  neighborhood: string | null
  location: { lat: number; lng: number } | null
  categories: string[]
  categoryName: string | null
  phone: string | null
  phoneUnformatted: string | null
  website: string | null
  totalScore: number | null
  reviewsCount: number | null
  permanentlyClosed: boolean
  temporarilyClosed: boolean
  openingHours: Array<{ day: string; hours: string }> | null
  imagesCount: number | null
  url: string | null
  rank: number | null
}

const ACTOR_ID = 'compass~crawler-google-places'
const MAX_CANDIDATES = 3
const SYNC_TIMEOUT_MS = 90_000

export class MapsApiError extends Error {
  constructor(
    public reason: 'no_key' | 'not_found' | 'rate_limited' | 'denied' | 'timeout' | 'unknown',
    message: string,
  ) {
    super(message)
    this.name = 'MapsApiError'
  }
}

export class MapsService {
  /**
   * Top-N candidates voor één query via Apify-actor. Eerste candidate = best
   * match volgens Apify rank. Caller (orchestrator) zet `parsed = candidates[0]`
   * als default; user kan via UI promoten.
   */
  async enrichByQueryMulti(query: string): Promise<NormalizedFields[]> {
    const cacheKey = `apify_maps:${query.toLowerCase().trim()}`
    const { value: items } = await cachedFetch('apify_maps', cacheKey, '30d', async () => {
      try {
        return await runActorSync<ApifyGoogleMapsItem>({
          actorId: ACTOR_ID,
          input: {
            searchStringsArray: [query],
            locationQuery: 'Netherlands',
            maxCrawledPlacesPerSearch: MAX_CANDIDATES,
            language: 'nl',
            skipClosedPlaces: false,
          },
          timeoutMs: SYNC_TIMEOUT_MS,
        })
      } catch (e) {
        if (e instanceof ApifyApiError) {
          if (e.reason === 'no_token') throw new MapsApiError('no_key', e.message)
          if (e.reason === 'auth') throw new MapsApiError('denied', e.message)
          if (e.reason === 'timeout') throw new MapsApiError('timeout', e.message)
          throw new MapsApiError('unknown', e.message)
        }
        throw e
      }
    })

    if (!items || items.length === 0) {
      throw new MapsApiError('not_found', `Apify Maps geen hits voor "${query}"`)
    }
    return items.slice(0, MAX_CANDIDATES).map((it) => this.mapApifyToNormalized(it))
  }

  /** Backwards-compat: top-1 candidate. Niet gebruikt in nieuwe orchestrator-flow. */
  async enrichByQuery(query: string): Promise<NormalizedFields> {
    const all = await this.enrichByQueryMulti(query)
    return all[0]
  }

  private mapApifyToNormalized(d: ApifyGoogleMapsItem): NormalizedFields {
    const phone = d.phone ?? d.phoneUnformatted ?? undefined
    const country =
      d.countryCode === 'NL' ? 'Nederland' : d.countryCode ? d.countryCode : undefined

    const address = d.address || d.street || d.city
      ? {
          street: d.street ?? undefined,
          postcode: d.postalCode ?? undefined,
          city: d.city ?? undefined,
          country,
          full: d.address ?? undefined,
        }
      : undefined

    const openingHours = (d.openingHours ?? [])
      .map((o) => `${o.day}: ${o.hours}`)
      .filter((s) => s.trim().length > 0)

    const businessTypes = [d.categoryName, ...(d.categories ?? [])]
      .filter((x): x is string => !!x && x.length > 0)

    const businessStatus = d.permanentlyClosed
      ? 'CLOSED_PERMANENTLY'
      : d.temporarilyClosed
      ? 'CLOSED_TEMPORARILY'
      : 'OPERATIONAL'

    return {
      company_name: d.title,
      address,
      coordinates: d.location ? { lat: d.location.lat, lng: d.location.lng } : undefined,
      website: d.website ?? undefined,
      phone,
      phones_all: phone ? [phone] : undefined,
      rating: d.totalScore ?? undefined,
      ratings_total: d.reviewsCount ?? undefined,
      business_status: businessStatus,
      opening_hours: openingHours.length ? openingHours : undefined,
      business_types: businessTypes.length ? businessTypes : undefined,
      photos_count: d.imagesCount ?? undefined,
      source: 'google_maps',
    }
  }

  async health(): Promise<SourceHealth> {
    if (!process.env.APIFY_TOKEN) {
      return { ok: false, latency_ms: 0, message: 'APIFY_TOKEN ontbreekt' }
    }
    const t0 = Date.now()
    try {
      const candidates = await this.enrichByQueryMulti('WeTarget')
      return {
        ok: candidates.length > 0,
        latency_ms: Date.now() - t0,
        message: candidates.length > 0 ? undefined : 'Geen test-resultaat',
      }
    } catch (e) {
      const msg = e instanceof MapsApiError ? `${e.reason}` : String(e)
      return { ok: false, latency_ms: Date.now() - t0, message: msg }
    }
  }
}
