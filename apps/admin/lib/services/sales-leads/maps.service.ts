import { cachedFetch } from './cache'
import type { NormalizedFields, SourceHealth } from './types'

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

type FindPlaceCandidate = {
  place_id: string
  name?: string
  formatted_address?: string
  geometry?: { location?: { lat: number; lng: number } }
}

type FindPlaceResponse = {
  status: string
  candidates?: FindPlaceCandidate[]
  error_message?: string
}

type PlaceDetails = {
  place_id: string
  name?: string
  formatted_address?: string
  formatted_phone_number?: string
  international_phone_number?: string
  geometry?: { location?: { lat: number; lng: number } }
  website?: string
  rating?: number
  user_ratings_total?: number
  business_status?: string
  opening_hours?: { weekday_text?: string[] }
  types?: string[]
  photos?: Array<unknown>
  address_components?: Array<{ long_name: string; short_name: string; types: string[] }>
}

type PlaceDetailsResponse = {
  status: string
  result?: PlaceDetails
  error_message?: string
}

export class MapsApiError extends Error {
  constructor(public reason: 'no_key' | 'not_found' | 'rate_limited' | 'denied' | 'unknown', message: string) {
    super(message)
    this.name = 'MapsApiError'
  }
}

const PLACE_DETAIL_FIELDS = [
  'place_id', 'name', 'formatted_address', 'formatted_phone_number', 'international_phone_number',
  'geometry/location', 'website', 'rating', 'user_ratings_total', 'business_status',
  'opening_hours/weekday_text', 'types', 'photos', 'address_components',
].join(',')

export class MapsService {
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY

  /**
   * Find Place from Text. Query = bedrijfsnaam + optioneel domein-stem.
   * Returnt max 1 candidate (we vragen om beste hit).
   */
  async findPlace(query: string): Promise<FindPlaceCandidate | null> {
    if (!this.apiKey) throw new MapsApiError('no_key', 'GOOGLE_MAPS_API_KEY ontbreekt')
    const cacheKey = `find:${query.toLowerCase().trim()}`
    const { value } = await cachedFetch('google_maps_find', cacheKey, '30d', async () => {
      const params = new URLSearchParams({
        input: query,
        inputtype: 'textquery',
        fields: 'place_id,name,formatted_address,geometry/location',
        language: 'nl',
        region: 'nl',
        key: this.apiKey!,
      })
      const res = await fetch(`${PLACES_BASE}/findplacefromtext/json?${params.toString()}`)
      if (!res.ok) throw new MapsApiError('unknown', `Maps findPlace HTTP ${res.status}`)
      const data = (await res.json()) as FindPlaceResponse
      if (data.status === 'ZERO_RESULTS') return [] as FindPlaceCandidate[]
      if (data.status === 'OVER_QUERY_LIMIT') throw new MapsApiError('rate_limited', data.error_message ?? 'OVER_QUERY_LIMIT')
      if (data.status === 'REQUEST_DENIED') throw new MapsApiError('denied', data.error_message ?? 'REQUEST_DENIED')
      if (data.status !== 'OK') throw new MapsApiError('unknown', `Maps status: ${data.status}`)
      return data.candidates ?? []
    })
    return value[0] ?? null
  }

  /**
   * Place Details voor 1 place_id.
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    if (!this.apiKey) throw new MapsApiError('no_key', 'GOOGLE_MAPS_API_KEY ontbreekt')
    const { value } = await cachedFetch('google_maps_details', placeId, '30d', async () => {
      const params = new URLSearchParams({
        place_id: placeId,
        fields: PLACE_DETAIL_FIELDS,
        language: 'nl',
        region: 'nl',
        key: this.apiKey!,
      })
      const res = await fetch(`${PLACES_BASE}/details/json?${params.toString()}`)
      if (!res.ok) throw new MapsApiError('unknown', `Maps details HTTP ${res.status}`)
      const data = (await res.json()) as PlaceDetailsResponse
      if (data.status === 'NOT_FOUND' || data.status === 'ZERO_RESULTS') {
        throw new MapsApiError('not_found', `Maps place_id niet gevonden: ${placeId}`)
      }
      if (data.status === 'OVER_QUERY_LIMIT') throw new MapsApiError('rate_limited', data.error_message ?? 'OVER_QUERY_LIMIT')
      if (data.status === 'REQUEST_DENIED') throw new MapsApiError('denied', data.error_message ?? 'REQUEST_DENIED')
      if (data.status !== 'OK' || !data.result) throw new MapsApiError('unknown', `Maps status: ${data.status}`)
      return data.result
    })
    return value
  }

  /**
   * Hoofd-flow: query "{bedrijfsnaam} {optioneel domein}" → place_id → details → NormalizedFields.
   * Throws MapsApiError(not_found) als findPlace 0 candidates retourneert.
   */
  async enrichByQuery(query: string): Promise<NormalizedFields> {
    const candidate = await this.findPlace(query)
    if (!candidate) throw new MapsApiError('not_found', `Maps geen hit voor "${query}"`)
    const details = await this.getPlaceDetails(candidate.place_id)
    return this.mapDetailsToNormalized(details)
  }

  private mapDetailsToNormalized(d: PlaceDetails): NormalizedFields {
    const components = d.address_components ?? []
    const find = (type: string) => components.find((c) => c.types.includes(type))
    const street = find('route')?.long_name
    const number = find('street_number')?.long_name
    const postcode = find('postal_code')?.long_name
    const city = find('locality')?.long_name ?? find('postal_town')?.long_name
    const country = find('country')?.long_name

    const phone = d.international_phone_number ?? d.formatted_phone_number
    return {
      company_name: d.name,
      address: (d.formatted_address || street || city)
        ? {
            street,
            number,
            postcode,
            city,
            country,
            full: d.formatted_address,
          }
        : undefined,
      coordinates: d.geometry?.location
        ? { lat: d.geometry.location.lat, lng: d.geometry.location.lng }
        : undefined,
      website: d.website,
      phone,
      phones_all: phone ? [phone] : undefined,
      rating: d.rating,
      ratings_total: d.user_ratings_total,
      business_status: d.business_status,
      opening_hours: d.opening_hours?.weekday_text,
      business_types: d.types,
      photos_count: d.photos?.length,
      source: 'google_maps',
    }
  }

  async health(): Promise<SourceHealth> {
    if (!this.apiKey) {
      return { ok: false, latency_ms: 0, message: 'GOOGLE_MAPS_API_KEY ontbreekt (TODO Kenny)' }
    }
    const t0 = Date.now()
    try {
      const c = await this.findPlace('WeTarget Naaldwijk')
      return {
        ok: c !== null,
        latency_ms: Date.now() - t0,
        message: c ? undefined : 'Geen test-resultaat',
      }
    } catch (e) {
      const msg = e instanceof MapsApiError ? `${e.reason}` : String(e)
      return { ok: false, latency_ms: Date.now() - t0, message: msg }
    }
  }
}
