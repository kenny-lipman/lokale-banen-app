import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlatformMatcherService } from '@/lib/services/sales-leads/platform-matcher.service'

const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom } as any

beforeEach(() => {
  mockFrom.mockReset()
})

describe('PlatformMatcherService', () => {
  it('matchByPostcode: 2671 → WestlandseBanen', async () => {
    // 1e call: cities lookup
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { platform_id: 'plat-westland' }, error: null }) }) }) }) }),
    })
    // 2e call: platforms lookup
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { regio_platform: 'WestlandseBanen' }, error: null }) }) }),
    })
    const svc = new PlatformMatcherService(mockSupabase)
    const r = await svc.matchByPostcode('2671AB')
    expect(r).toEqual({ platform_id: 'plat-westland', regio_platform: 'WestlandseBanen' })
  })

  it('matchByPostcode: onbekende postcode → null', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
    })
    const svc = new PlatformMatcherService(mockSupabase)
    expect(await svc.matchByPostcode('9999XX')).toBeNull()
  })

  it('matchByCity: "Naaldwijk" → WestlandseBanen', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({ ilike: () => ({ not: () => ({ order: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { platform_id: 'plat-westland', postcode: '2671' }, error: null }) }) }) }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { regio_platform: 'WestlandseBanen' }, error: null }) }) }),
    })
    const svc = new PlatformMatcherService(mockSupabase)
    const r = await svc.matchByCity('Naaldwijk')
    expect(r?.regio_platform).toBe('WestlandseBanen')
  })

  it('matchByAddress: probeert postcode eerst, dan city fallback', async () => {
    // postcode lookup: niet gevonden
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
    })
    // city lookup: hit
    mockFrom.mockReturnValueOnce({
      select: () => ({ ilike: () => ({ not: () => ({ order: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: { platform_id: 'plat-x', postcode: '1234' }, error: null }) }) }) }) }) }) }),
    })
    mockFrom.mockReturnValueOnce({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { regio_platform: 'XYZBanen' }, error: null }) }) }),
    })
    const svc = new PlatformMatcherService(mockSupabase)
    const r = await svc.matchByAddress({ postcode: '0000', city: 'Onbekend' })
    expect(r?.regio_platform).toBe('XYZBanen')
  })

  it('matchByAddress: lege input → null', async () => {
    const svc = new PlatformMatcherService(mockSupabase)
    expect(await svc.matchByAddress({})).toBeNull()
    expect(await svc.matchByAddress({ postcode: '', city: '' })).toBeNull()
  })
})
