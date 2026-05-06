import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchCity } from '@/lib/automations/fix-job-postings-geocoding/locationiq-client'

const apiKey = 'test-key'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('searchCity', () => {
  it('returns ok with result on 200', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([
        { lat: '52.37', lon: '4.89', display_name: 'Amsterdam', address: { city: 'Amsterdam', postcode: '1011', country_code: 'nl' } },
      ]),
    } as unknown as Response)
    const r = await searchCity('Amsterdam', { apiKey })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.result.address.postcode).toBe('1011')
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('eu1.locationiq.com/v1/search'),
      expect.any(Object)
    )
  })

  it('returns no_match on empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([]),
    } as unknown as Response)
    const r = await searchCity('NietBestaand', { apiKey })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('no_match')
  })

  it('returns rate_limit on 429', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: 'Rate limit' }),
    } as unknown as Response)
    const r = await searchCity('Amsterdam', { apiKey })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('rate_limit')
  })

  it('returns auth_failed on 401', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: 'Bad key' }),
    } as unknown as Response)
    const r = await searchCity('Amsterdam', { apiKey })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('auth_failed')
  })

  it('encodes city query', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ([{ lat: '0', lon: '0', display_name: '', address: {} }]),
    } as unknown as Response)
    await searchCity("'s-Gravenhage", { apiKey })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("'s-Gravenhage")),
      expect.any(Object)
    )
  })
})
