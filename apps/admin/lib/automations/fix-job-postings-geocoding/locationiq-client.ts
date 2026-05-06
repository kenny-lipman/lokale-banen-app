// apps/admin/lib/automations/fix-job-postings-geocoding/locationiq-client.ts

import type { LocationIQSearchResult, SearchOutcome } from './types'

const BASE_URL = 'https://eu1.locationiq.com/v1/search'

export interface SearchOptions {
  apiKey: string
  /** Voor server-side gebruik — dictates User-Agent header */
  userAgent?: string
}

/**
 * Forward geocoding via LocationIQ EU endpoint.
 * Eén call levert lat/lng + address.postcode (mits dat bekend is).
 * Geen retry — caller is verantwoordelijk voor backoff op rate_limit.
 */
export async function searchCity(city: string, opts: SearchOptions): Promise<SearchOutcome> {
  const params = [
    `q=${encodeURIComponent(city)}`,
    `format=json`,
    `addressdetails=1`,
    `countrycodes=nl`,
    `limit=1`,
    `key=${encodeURIComponent(opts.apiKey)}`,
  ].join('&')
  const url = `${BASE_URL}?${params}`

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': opts.userAgent ?? 'LokaleBanen/1.0 (kenny@bespokeautomation.ai)',
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return {
      ok: false,
      reason: 'http_error',
      message: err instanceof Error ? err.message : 'fetch failed',
    }
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: 'auth_failed', httpStatus: response.status, message: `LocationIQ ${response.status}` }
  }
  if (response.status === 429) {
    return { ok: false, reason: 'rate_limit', httpStatus: 429, message: 'LocationIQ rate limit' }
  }
  if (!response.ok) {
    return { ok: false, reason: 'http_error', httpStatus: response.status, message: `LocationIQ ${response.status}` }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'http_error', message: 'invalid JSON' }
  }

  if (!Array.isArray(body) || body.length === 0) {
    return { ok: false, reason: 'no_match' }
  }

  return { ok: true, result: body[0] as LocationIQSearchResult }
}
