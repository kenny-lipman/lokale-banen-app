import { describe, it, expect } from 'vitest'
import {
  nextSelectedRowCache,
  type BulkTargetRowInput,
  type SelectedRowCacheValue,
} from '@/lib/cities/selected-row-cache'

const row = (id: string, plaats = 'Test'): BulkTargetRowInput => ({
  id,
  plaats,
  postcode: '1234AB',
  suggested_platform_id: null,
  suggested_regio_platform: null,
})

describe('nextSelectedRowCache', () => {
  it('voegt geselecteerde rij toe', () => {
    const prev = new Map<string, SelectedRowCacheValue>()
    const next = nextSelectedRowCache(prev, [row('a'), row('b')], new Set(['a']))
    expect(next.size).toBe(1)
    expect(next.get('a')?.id).toBe('a')
  })

  it('verwijdert rij die niet meer geselecteerd is', () => {
    const prev = new Map<string, SelectedRowCacheValue>([
      ['a', { ...row('a') }],
    ])
    const next = nextSelectedRowCache(prev, [row('a')], new Set())
    expect(next.size).toBe(0)
  })

  it('returnt dezelfde Map-referentie als er niks verandert (voorkomt React #185 loop)', () => {
    const prev = new Map<string, SelectedRowCacheValue>([
      ['a', { ...row('a') }],
    ])
    const pagedRows = [row('a'), row('b')]
    const selectedIds = new Set(['a'])

    const first = nextSelectedRowCache(prev, pagedRows, selectedIds)
    const second = nextSelectedRowCache(first, pagedRows, selectedIds)

    expect(first).toBe(prev)
    expect(second).toBe(first)
  })

  it('returnt zelfde referentie als pagedRows leeg is en selectie leeg', () => {
    const prev = new Map<string, SelectedRowCacheValue>()
    const next = nextSelectedRowCache(prev, [], new Set())
    expect(next).toBe(prev)
  })

  it('returnt zelfde referentie als pagedRows nieuwe array-ref is maar inhoud gelijk', () => {
    // Simuleert de bug-bron: listData?.rows ?? [] creëert per render nieuwe []
    const prev = new Map<string, SelectedRowCacheValue>()
    const first = nextSelectedRowCache(prev, [], new Set())
    const second = nextSelectedRowCache(first, [], new Set())
    const third = nextSelectedRowCache(second, [], new Set())
    expect(first).toBe(prev)
    expect(second).toBe(first)
    expect(third).toBe(second)
  })

  it('update bestaande cache-entry als rij-velden veranderen', () => {
    const prev = new Map<string, SelectedRowCacheValue>([
      ['a', { ...row('a', 'Oud') }],
    ])
    const next = nextSelectedRowCache(prev, [row('a', 'Nieuw')], new Set(['a']))
    expect(next).not.toBe(prev)
    expect(next.get('a')?.plaats).toBe('Nieuw')
  })

  it('returnt zelfde ref als rij identiek is (inhoudsvergelijking)', () => {
    const prev = new Map<string, SelectedRowCacheValue>([
      ['a', { ...row('a') }],
    ])
    const next = nextSelectedRowCache(prev, [row('a')], new Set(['a']))
    expect(next).toBe(prev)
  })
})
