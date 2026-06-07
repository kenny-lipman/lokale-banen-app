import { describe, it, expect } from 'vitest'
import { computePrimaryMaster } from '@/lib/services/sales-leads/master-record'
import type {
  RunEnrichments,
  NormalizedFields,
  SourceKey,
} from '@/lib/services/sales-leads/types'
import type { SourcePreferences } from '@/lib/services/sales-leads/master-record'

/**
 * Borgt de bron-prioriteit (FIELD_PRIORITY) na de herordening:
 *   - contactgegevens (adres, telefoon, e-mail): website -> apollo -> maps -> kvk
 *   - officiele identiteit (bedrijfsnaam, kvk-nummer): kvk voorop
 * `inputUrl` is leeg gehouden zodat het `website`-veld niet door de input-URL
 * override wordt overschreven.
 */
function enrich(parts: Partial<Record<'kvk' | 'google_maps' | 'apollo' | 'website', NormalizedFields>>): RunEnrichments {
  const wrap = (parsed?: NormalizedFields) =>
    parsed ? { status: 'completed' as const, parsed } : undefined
  return {
    kvk: wrap(parts.kvk),
    google_maps: wrap(parts.google_maps),
    apollo: wrap(parts.apollo),
    website: wrap(parts.website),
  }
}

describe('computePrimaryMaster bron-prioriteit (contactgegevens)', () => {
  it('telefoon: website wint van apollo/maps/kvk', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { phone: '010-kvk' },
        google_maps: { phone: '010-maps' },
        apollo: { phone: '010-apollo' },
        website: { phone: '010-website' },
      }),
      '',
    )
    expect(master.phone).toBe('010-website')
    expect(master.source_overrides.phone).toBe('website')
  })

  it('telefoon: zonder website wint apollo van maps en kvk', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { phone: '010-kvk' },
        google_maps: { phone: '010-maps' },
        apollo: { phone: '010-apollo' },
      }),
      '',
    )
    expect(master.phone).toBe('010-apollo')
    expect(master.source_overrides.phone).toBe('apollo')
  })

  it('telefoon: alleen kvk -> kvk als laatste fallback', () => {
    const master = computePrimaryMaster(enrich({ kvk: { phone: '010-kvk' } }), '')
    expect(master.phone).toBe('010-kvk')
    expect(master.source_overrides.phone).toBe('kvk')
  })

  it('adres: website wint van google_maps en kvk', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { address: { full: 'KvK-adres 1' } },
        apollo: { address: { full: 'Apollo-adres 2' } },
        google_maps: { address: { full: 'Maps-adres 2' } },
        website: { address: { full: 'Website-adres 3' } },
      }),
      '',
    )
    expect(master.address?.full).toBe('Website-adres 3')
    expect(master.source_overrides.address).toBe('website')
  })

  it('adres: zonder website wint apollo van maps en kvk', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { address: { full: 'KvK-adres 1' } },
        google_maps: { address: { full: 'Maps-adres 2' } },
        apollo: { address: { full: 'Apollo-adres 3' } },
      }),
      '',
    )
    expect(master.address?.full).toBe('Apollo-adres 3')
    expect(master.source_overrides.address).toBe('apollo')
  })

  it('e-mail: website wint van kvk', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { email: 'info@kvk.nl' },
        google_maps: { email: 'info@maps.nl' },
        apollo: { email: 'info@apollo.nl' },
        website: { email: 'info@site.nl' },
      }),
      '',
    )
    expect(master.email).toBe('info@site.nl')
    expect(master.source_overrides.email).toBe('website')
  })

  it('e-mail: zonder website wint apollo van maps en kvk', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { email: 'info@kvk.nl' },
        google_maps: { email: 'info@maps.nl' },
        apollo: { email: 'info@apollo.nl' },
      }),
      '',
    )
    expect(master.email).toBe('info@apollo.nl')
    expect(master.source_overrides.email).toBe('apollo')
  })
})

describe('computePrimaryMaster bron-prioriteit (officiele identiteit blijft KvK)', () => {
  it('bedrijfsnaam: kvk wint van apollo/website', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { company_name: 'Acme B.V.' },
        apollo: { company_name: 'Acme' },
        website: { company_name: 'Acme - de beste!' },
      }),
      '',
    )
    expect(master.company_name).toBe('Acme B.V.')
    expect(master.source_overrides.company_name).toBe('kvk')
  })
})

describe('computePrimaryMaster globale bronvoorkeuren', () => {
  it('laat een configureerbare favoriete bron winnen als die een waarde heeft', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { phone: '010-kvk' },
        google_maps: { phone: '010-maps' },
        apollo: { phone: '010-apollo' },
        website: { phone: '010-website' },
      }),
      '',
      { phone: 'google_maps' },
    )

    expect(master.phone).toBe('010-maps')
    expect(master.source_overrides.phone).toBe('google_maps')
  })

  it('valt terug op de normale prioriteit als de favoriete bron leeg is', () => {
    const master = computePrimaryMaster(
      enrich({
        kvk: { email: 'info@kvk.nl' },
        apollo: { email: 'info@apollo.nl' },
        website: { email: 'info@site.nl' },
      }),
      '',
      { email: 'google_maps' },
    )

    expect(master.email).toBe('info@site.nl')
    expect(master.source_overrides.email).toBe('website')
  })

  it('negeert voorkeuren voor beschermde officiele velden', () => {
    const unsafePreferences = {
      company_name: 'website' as Exclude<SourceKey, 'custom'>,
      kvk_number: 'website' as Exclude<SourceKey, 'custom'>,
    } as unknown as SourcePreferences

    const master = computePrimaryMaster(
      enrich({
        kvk: { company_name: 'Acme B.V.', kvk_number: '12345678' },
        website: { company_name: 'Acme marketingnaam', kvk_number: '87654321' },
      }),
      '',
      unsafePreferences,
    )

    expect(master.company_name).toBe('Acme B.V.')
    expect(master.kvk_number).toBe('12345678')
    expect(master.source_overrides.company_name).toBe('kvk')
    expect(master.source_overrides.kvk_number).toBe('kvk')
  })

  it('houdt de input-URL leidend voor website, ook bij een onveilige preference', () => {
    const unsafePreferences = {
      website: 'apollo' as Exclude<SourceKey, 'custom'>,
    } as unknown as SourcePreferences

    const master = computePrimaryMaster(
      enrich({
        apollo: { website: 'https://apollo.example' },
        website: { website: 'https://site.example' },
      }),
      'input.example',
      unsafePreferences,
    )

    expect(master.website).toBe('https://input.example')
    expect(master.source_overrides.website).toBe('custom')
  })
})
