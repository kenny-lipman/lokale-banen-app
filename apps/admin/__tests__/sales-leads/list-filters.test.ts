import { describe, it, expect } from 'vitest'
import { parseRunListQuery, ALLOWED_STATUSES } from '@/lib/services/sales-leads/list-filters'

describe('parseRunListQuery', () => {
  it('returns defaults voor lege URLSearchParams', () => {
    const r = parseRunListQuery(new URLSearchParams())
    expect(r).toEqual({
      status: null,
      owner_config_id: null,
      search: null,
      date_from: null,
      date_to: null,
      include_archived: false,
      page: 1,
      limit: 25,
    })
  })

  it('parsed include_archived alleen bij archived=1 of archived=true', () => {
    expect(parseRunListQuery(new URLSearchParams('archived=1')).include_archived).toBe(true)
    expect(parseRunListQuery(new URLSearchParams('archived=true')).include_archived).toBe(true)
    expect(parseRunListQuery(new URLSearchParams('archived=0')).include_archived).toBe(false)
    expect(parseRunListQuery(new URLSearchParams('archived=foo')).include_archived).toBe(false)
    expect(parseRunListQuery(new URLSearchParams()).include_archived).toBe(false)
  })

  it('parsed status alleen als waarde in ALLOWED_STATUSES staat', () => {
    expect(parseRunListQuery(new URLSearchParams('status=review')).status).toBe('review')
    expect(parseRunListQuery(new URLSearchParams('status=foobar')).status).toBeNull()
    expect(parseRunListQuery(new URLSearchParams('status=all')).status).toBeNull()
  })

  it('parsed owner_config_id alleen als geldige uuid-vorm', () => {
    const valid = '11111111-2222-3333-4444-555555555555'
    expect(parseRunListQuery(new URLSearchParams(`owner=${valid}`)).owner_config_id).toBe(valid)
    expect(parseRunListQuery(new URLSearchParams('owner=not-a-uuid')).owner_config_id).toBeNull()
    expect(parseRunListQuery(new URLSearchParams('owner=all')).owner_config_id).toBeNull()
  })

  it('trim-t en limit-en search op 100 chars', () => {
    expect(parseRunListQuery(new URLSearchParams('search=  hello  ')).search).toBe('hello')
    expect(parseRunListQuery(new URLSearchParams('search=')).search).toBeNull()
    const long = 'a'.repeat(150)
    expect(parseRunListQuery(new URLSearchParams(`search=${long}`)).search).toHaveLength(100)
  })

  it('parsed date_from / date_to alleen YYYY-MM-DD format', () => {
    expect(parseRunListQuery(new URLSearchParams('date_from=2026-05-01')).date_from).toBe('2026-05-01')
    expect(parseRunListQuery(new URLSearchParams('date_to=2026-05-08')).date_to).toBe('2026-05-08')
    expect(parseRunListQuery(new URLSearchParams('date_from=invalid')).date_from).toBeNull()
    expect(parseRunListQuery(new URLSearchParams('date_from=2026/05/01')).date_from).toBeNull()
  })

  it('clamp page tussen 1 en max', () => {
    expect(parseRunListQuery(new URLSearchParams('page=0')).page).toBe(1)
    expect(parseRunListQuery(new URLSearchParams('page=-5')).page).toBe(1)
    expect(parseRunListQuery(new URLSearchParams('page=abc')).page).toBe(1)
    expect(parseRunListQuery(new URLSearchParams('page=3')).page).toBe(3)
  })

  it('clamp limit tussen 1 en 100, default 25', () => {
    expect(parseRunListQuery(new URLSearchParams('limit=10')).limit).toBe(10)
    expect(parseRunListQuery(new URLSearchParams('limit=500')).limit).toBe(100)
    expect(parseRunListQuery(new URLSearchParams('limit=0')).limit).toBe(25)
    expect(parseRunListQuery(new URLSearchParams('limit=abc')).limit).toBe(25)
  })

  it('ALLOWED_STATUSES dekt alle 6 mogelijke statussen', () => {
    expect(ALLOWED_STATUSES).toEqual([
      'enriching',
      'review',
      'syncing',
      'completed',
      'failed',
      'duplicate',
    ])
  })
})
