import { describe, it, expect, vi } from 'vitest'
import { loadCityResolver } from '@/lib/automations/fix-job-postings-geocoding/cities-batch-match'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CityRow {
  plaats: string
  postcode: string
  platform_id: string
}

function makeMockSupabase(rows: CityRow[] | null, error: { message: string } | null = null) {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    // resolver doet uiteindelijk `await` op de chain — emuleer thenable
    then: (resolve: (v: { data: CityRow[] | null; error: typeof error }) => unknown) =>
      Promise.resolve({ data: rows, error }).then(resolve),
  }
  return mock as unknown as SupabaseClient
}

describe('loadCityResolver', () => {
  it('returns unique match for single-platform plaats', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Aalsmeer', postcode: '1431', platform_id: 'p-aalsmeer' },
      { plaats: 'Aalsmeer', postcode: '1432', platform_id: 'p-aalsmeer' },
    ])
    const r = await loadCityResolver(supabase)
    const m = r.resolve('Aalsmeer')
    expect(m).not.toBeNull()
    expect(m?.kind).toBe('unique')
    if (m?.kind === 'unique') {
      expect(m.platform_id).toBe('p-aalsmeer')
      expect(m.postcode_4digit).toBeDefined()
    }
  })

  it('marks ambiguous when plaats has multiple platforms', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Bergen', postcode: '1861', platform_id: 'p-nh' },
      { plaats: 'Bergen', postcode: '5854', platform_id: 'p-limburg' },
    ])
    const r = await loadCityResolver(supabase)
    const m = r.resolve('Bergen')
    expect(m?.kind).toBe('ambiguous')
  })

  it('returns null when plaats not in resolver', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Amsterdam', postcode: '1011', platform_id: 'p-ams' },
    ])
    const r = await loadCityResolver(supabase)
    expect(r.resolve('Onbekend')).toBeNull()
  })

  it('is case-insensitive and trims input', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Amsterdam', postcode: '1011', platform_id: 'p-ams' },
    ])
    const r = await loadCityResolver(supabase)
    expect(r.resolve('  AMSTERDAM  ')?.kind).toBe('unique')
    expect(r.resolve('amsterdam')?.kind).toBe('unique')
  })

  it('falls back to trailing-word strip ("Amsterdam Zuid" → "Amsterdam")', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Amsterdam', postcode: '1011', platform_id: 'p-ams' },
    ])
    const r = await loadCityResolver(supabase)
    const m = r.resolve('Amsterdam Zuid')
    expect(m?.kind).toBe('unique')
  })

  it('does not strip if stripped variant is also unknown', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Utrecht', postcode: '3500', platform_id: 'p-utr' },
    ])
    const r = await loadCityResolver(supabase)
    expect(r.resolve('Rotterdam Zuid')).toBeNull()
  })

  it('returns null for null/empty city input', async () => {
    const supabase = makeMockSupabase([
      { plaats: 'Amsterdam', postcode: '1011', platform_id: 'p-ams' },
    ])
    const r = await loadCityResolver(supabase)
    expect(r.resolve(null)).toBeNull()
    expect(r.resolve('')).toBeNull()
    expect(r.resolve('   ')).toBeNull()
  })

  it('handles DB error gracefully with empty resolver', async () => {
    const supabase = makeMockSupabase(null, { message: 'boom' })
    const r = await loadCityResolver(supabase)
    expect(r.size).toBe(0)
    expect(r.resolve('Amsterdam')).toBeNull()
  })
})
