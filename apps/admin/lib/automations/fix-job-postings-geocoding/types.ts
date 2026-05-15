// apps/admin/lib/automations/fix-job-postings-geocoding/types.ts

export interface LocationIQAddress {
  road?: string
  postcode?: string
  city?: string
  town?: string
  village?: string
  state?: string
  country?: string
  country_code?: string
}

export interface LocationIQSearchResult {
  lat: string
  lon: string
  display_name: string
  address: LocationIQAddress
}

export interface SearchSuccess {
  ok: true
  result: LocationIQSearchResult
}

export interface SearchEmpty {
  ok: false
  reason: 'no_match'
}

export interface SearchError {
  ok: false
  reason: 'http_error' | 'auth_failed' | 'rate_limit'
  httpStatus?: number
  message: string
}

export type SearchOutcome = SearchSuccess | SearchEmpty | SearchError

export interface BusinessStats {
  processed: number
  enriched: number
  geocoding_failed_no_match: number
  geocoding_failed_no_postcode: number
  geocoding_failed_invalid_coords: number
  platform_matched: number
  platform_matched_via_cities: number
  postcode_via_random_street: number
  postcode_via_cities_fallback: number
  prematch_cities_unique: number
  prematch_skipped_ambiguous: number
  locationiq_dedup_hits: number
  queue_remaining: number
  api_calls_used: number
  stopped_early: boolean
  skipped_reason?: 'daily_budget_reached' | 'auth_failed'
}
