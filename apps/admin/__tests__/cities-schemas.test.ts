import { describe, it, expect } from 'vitest'
import {
  cityPatchSchema,
  bulkLinkSchema,
  pendingJobsSchema,
} from '@/lib/cities/schemas'

const VALID_UUID = '0f5f2eaa-01c2-4522-a450-75929d1c4fae'

describe('cityPatchSchema', () => {
  it('accepteert minimaal 1 veld', () => {
    expect(cityPatchSchema.safeParse({ plaats: 'Amsterdam' }).success).toBe(true)
    expect(cityPatchSchema.safeParse({ platform_id: VALID_UUID }).success).toBe(true)
    expect(cityPatchSchema.safeParse({ platform_id: null }).success).toBe(true)
    expect(cityPatchSchema.safeParse({ is_active: true }).success).toBe(true)
  })

  it('weigert lege body', () => {
    expect(cityPatchSchema.safeParse({}).success).toBe(false)
  })

  it('weigert ongeldige postcode', () => {
    expect(cityPatchSchema.safeParse({ postcode: '12345' }).success).toBe(false)
    expect(cityPatchSchema.safeParse({ postcode: 'ab12' }).success).toBe(false)
  })

  it('accepteert 4-cijferige postcode', () => {
    expect(cityPatchSchema.safeParse({ postcode: '1011' }).success).toBe(true)
  })

  it('weigert geen-UUID platform_id', () => {
    expect(cityPatchSchema.safeParse({ platform_id: 'not-a-uuid' }).success).toBe(false)
  })

  it('accepteert if_updated_at ISO timestamp', () => {
    const r = cityPatchSchema.safeParse({
      plaats: 'X',
      if_updated_at: '2026-05-15T10:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })

  it('trimt plaats whitespace', () => {
    const r = cityPatchSchema.safeParse({ plaats: '  Amsterdam  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.plaats).toBe('Amsterdam')
  })

  it('weigert plaats >120 chars', () => {
    const long = 'A'.repeat(121)
    expect(cityPatchSchema.safeParse({ plaats: long }).success).toBe(false)
  })
})

describe('bulkLinkSchema', () => {
  it('accepteert 1-1000 ids met platform_id', () => {
    expect(bulkLinkSchema.safeParse({ ids: [VALID_UUID], platform_id: VALID_UUID }).success).toBe(true)
  })

  it('weigert lege ids', () => {
    expect(bulkLinkSchema.safeParse({ ids: [], platform_id: VALID_UUID }).success).toBe(false)
  })

  it('weigert >1000 ids', () => {
    const ids = Array.from({ length: 1001 }, () => VALID_UUID)
    expect(bulkLinkSchema.safeParse({ ids, platform_id: VALID_UUID }).success).toBe(false)
  })

  it('weigert ongeldige UUID in ids', () => {
    expect(bulkLinkSchema.safeParse({ ids: ['not-uuid'], platform_id: VALID_UUID }).success).toBe(false)
  })

  it('accepteert activate zonder platform_id', () => {
    expect(bulkLinkSchema.safeParse({ ids: [VALID_UUID], activate: true }).success).toBe(true)
  })

  it('weigert geen platform_id én geen activate', () => {
    expect(bulkLinkSchema.safeParse({ ids: [VALID_UUID] }).success).toBe(false)
  })

  it('accepteert null platform_id (ontkoppelen)', () => {
    expect(bulkLinkSchema.safeParse({ ids: [VALID_UUID], platform_id: null }).success).toBe(true)
  })
})

describe('pendingJobsSchema', () => {
  it('accepteert array van ids', () => {
    expect(pendingJobsSchema.safeParse({ ids: [VALID_UUID] }).success).toBe(true)
  })

  it('weigert empty ids', () => {
    expect(pendingJobsSchema.safeParse({ ids: [] }).success).toBe(false)
  })

  it('weigert >1000 ids', () => {
    const ids = Array.from({ length: 1001 }, () => VALID_UUID)
    expect(pendingJobsSchema.safeParse({ ids }).success).toBe(false)
  })

  it('weigert non-array ids', () => {
    expect(pendingJobsSchema.safeParse({ ids: 'x' }).success).toBe(false)
  })
})
