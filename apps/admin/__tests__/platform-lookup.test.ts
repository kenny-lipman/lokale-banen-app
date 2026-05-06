import { describe, it, expect, vi } from 'vitest'
import { extractPostcodePrefix, findCityByName } from '@/lib/automations/fix-job-postings-geocoding/platform-lookup'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('extractPostcodePrefix', () => {
  it('returns first 4 digits from "1011 AB"', () => {
    expect(extractPostcodePrefix('1011 AB')).toBe('1011')
  })
  it('returns first 4 digits from "1011AB"', () => {
    expect(extractPostcodePrefix('1011AB')).toBe('1011')
  })
  it('returns null for null input', () => {
    expect(extractPostcodePrefix(null)).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(extractPostcodePrefix('')).toBeNull()
  })
  it('returns null for postcode without 4-digit prefix', () => {
    expect(extractPostcodePrefix('AB12')).toBeNull()
  })
  it('handles "1011" alone', () => {
    expect(extractPostcodePrefix('1011')).toBe('1011')
  })
})

function makeMockSupabase(rows: Array<{ platform_id: string | null; postcode: string | null }> | null, error: { message: string } | null = null) {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows?.[0] ?? null, error }),
  }
  return mock as unknown as SupabaseClient
}

describe('findCityByName', () => {
  it('returns platform_id and postcode when city found', async () => {
    const supabase = makeMockSupabase([{ platform_id: 'plat-1', postcode: '1011' }])
    const r = await findCityByName(supabase, 'Amsterdam')
    expect(r).toEqual({ platform_id: 'plat-1', postcode_4digit: '1011' })
  })

  it('returns null when city not found', async () => {
    const supabase = makeMockSupabase([])
    const r = await findCityByName(supabase, 'Onbekend Dorp')
    expect(r).toBeNull()
  })

  it('returns null on DB error', async () => {
    const supabase = makeMockSupabase(null, { message: 'connection lost' })
    const r = await findCityByName(supabase, 'Amsterdam')
    expect(r).toBeNull()
  })
})
