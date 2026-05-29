import { describe, it, expect } from 'vitest'
import { buildSyntheticPersoneelszaken } from '@/lib/services/sales-leads/synthetic-contact'
import type { NormalizedContact } from '@/lib/services/sales-leads/types'

describe('buildSyntheticPersoneelszaken', () => {
  const masterEmpty = { email: undefined, phone: undefined }

  it('skipt wanneer er al een Personeelszaken-record bestaat (Mistral website-fallback wint)', () => {
    const existing: NormalizedContact[] = [
      {
        name: 'Afdeling Personeelszaken',
        email: 'hr@bedrijf.nl',
        source_origin: ['website'],
      },
    ]
    const result = buildSyntheticPersoneelszaken(
      { email: 'info@bedrijf.nl', phone: '+31 174 257 221' },
      'bedrijf.nl',
      existing,
    )
    expect(result).toBeNull()
  })

  it('skipt case/whitespace-varianten van bestaande Personeelszaken-naam', () => {
    const existing: NormalizedContact[] = [
      {
        name: '  AFDELING   PERSONEELSZAKEN ',
        email: 'hr@bedrijf.nl',
        source_origin: ['website'],
      },
    ]
    const result = buildSyntheticPersoneelszaken(
      { email: 'info@bedrijf.nl', phone: undefined },
      'bedrijf.nl',
      existing,
    )
    expect(result).toBeNull()
  })

  it('injecteert met master.email + master.phone wanneer beide aanwezig', () => {
    const result = buildSyntheticPersoneelszaken(
      { email: 'info@bedrijf.nl', phone: '0612345678' },
      'bedrijf.nl',
      [],
    )
    expect(result).not.toBeNull()
    expect(result?.name).toBe('Afdeling Personeelszaken')
    expect(result?.email).toBe('info@bedrijf.nl')
    expect(result?.phone_mobile).toBe('0612345678')
    expect(result?.phone_other).toBeUndefined()
    expect(result?.department).toBe('human_resources')
    expect(result?.source_origin).toEqual(['synthetic'])
    expect(result?.ai_priority_score).toBe(10)
  })

  it('classificeert vast nummer (0174-...) als phone_other ipv phone_mobile', () => {
    const result = buildSyntheticPersoneelszaken(
      { email: 'info@bedrijf.nl', phone: '+31 174 257 221' },
      'bedrijf.nl',
      [],
    )
    expect(result?.phone_other).toBe('+31 174 257 221')
    expect(result?.phone_mobile).toBeUndefined()
  })

  it('valt terug op info@{apex} wanneer master.email ontbreekt maar inputDomain aanwezig is', () => {
    const result = buildSyntheticPersoneelszaken(
      { email: undefined, phone: '0612345678' },
      'sub.bedrijf.nl',
      [],
    )
    // extractApex strips subdomain -> 'bedrijf.nl'
    expect(result?.email).toBe('info@bedrijf.nl')
  })

  it('skipt wanneer noch email noch phone beschikbaar zijn', () => {
    const result = buildSyntheticPersoneelszaken(masterEmpty, null, [])
    expect(result).toBeNull()
  })

  it('skipt wanneer email leeg is en inputDomain leeg en geen phone', () => {
    const result = buildSyntheticPersoneelszaken({ email: undefined, phone: undefined }, '', [])
    expect(result).toBeNull()
  })

  it('injecteert ook wanneer alleen phone beschikbaar is (geen email, geen domain)', () => {
    const result = buildSyntheticPersoneelszaken(
      { email: undefined, phone: '0612345678' },
      null,
      [],
    )
    expect(result).not.toBeNull()
    expect(result?.email).toBeUndefined()
    expect(result?.phone_mobile).toBe('0612345678')
  })
})
