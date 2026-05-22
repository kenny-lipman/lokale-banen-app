import { describe, it, expect } from 'vitest'
import {
  buildOrgPayload,
  buildPersonPayload,
  buildDealPayload,
  nextWorkday,
} from '@/lib/services/sales-leads/pipedrive-payloads'
import type { MasterRecord, NormalizedContact } from '@/lib/services/sales-leads/types'

const owner = {
  id: 'owner-1',
  pipedrive_user_id: 22971285,
  pipedrive_pipeline_id: 11,
  pipedrive_default_stage_id: 66,
  hoofddomein_strategy: 'fixed' as const,
  hoofddomein_fixed_value: 'WeTarget',
  hoofddomein_fixed_option_id: null,
  wetarget_flag_value: 265,
  contactmoment_field_key: '6b624a58761cbbd7a95363c1a5c969daa172563c',
  contactmoment_offset_workdays: 1,
}

const resolvedDefaults = { hoofddomeinOptionId: null, brancheEnumId: null }

const masterFull: MasterRecord = {
  company_name: 'WeTarget B.V.',
  kvk_number: '87886022',
  phone: '+31 174 257 221',
  email: 'info@wetarget.nl',
  website: 'https://www.wetarget.nl',
  address: { full: 'Slotenmakerstraat 60, 2672GD Naaldwijk', postcode: '2672GD', city: 'Naaldwijk' },
  employee_bucket: 'klein_<10',
  industry_codes: ['8299'],
  hoofddomein: 'WeTarget',
  source_overrides: {},
  deal_note_text: '',
}

describe('buildOrgPayload', () => {
  it('zet name, owner_id, address en custom_fields', () => {
    const p = buildOrgPayload(masterFull, owner, resolvedDefaults)
    expect(p.name).toBe('WeTarget B.V.')
    expect(p.owner_id).toBe(22971285)
    expect(p.address).toEqual([{ value: 'Slotenmakerstraat 60, 2672GD Naaldwijk' }])
    expect(p.custom_fields).toBeDefined()
  })

  it('skipt address als geen enkel adres-veld gevuld is', () => {
    const p = buildOrgPayload({ ...masterFull, address: undefined }, owner, resolvedDefaults)
    expect(p.address).toBeUndefined()
  })

  it('composet address uit losse velden als full ontbreekt', () => {
    const p = buildOrgPayload(
      { ...masterFull, address: { street: 'Slotenmakerstraat', number: '60', postcode: '2672GD', city: 'Naaldwijk' } },
      owner,
      resolvedDefaults,
    )
    expect(p.address).toEqual([{ value: 'Slotenmakerstraat 60, 2672GD Naaldwijk' }])
  })

  it('zet wetarget-flag uit owner_config', () => {
    const p = buildOrgPayload(masterFull, owner, resolvedDefaults)
    expect(JSON.stringify(p.custom_fields)).toContain('265')
  })

  it('zet branche-enum als brancheEnumId meegegeven', () => {
    const p = buildOrgPayload(masterFull, owner, { hoofddomeinOptionId: null, brancheEnumId: 295 })
    expect(JSON.stringify(p.custom_fields)).toContain('295')
  })

  it('skipt branche-veld als brancheEnumId null is', () => {
    const p = buildOrgPayload(masterFull, owner, resolvedDefaults)
    expect(p.custom_fields['5a467ae0b810dc79d37df067c568af40d8414882']).toBeUndefined()
  })

  it('skipt company_name → throws', () => {
    expect(() => buildOrgPayload({ ...masterFull, company_name: undefined }, owner, resolvedDefaults)).toThrow(
      /company_name/,
    )
  })
})

describe('buildPersonPayload', () => {
  const contact: NormalizedContact = {
    name: 'Bart van der Klaauw',
    title: 'Eigenaar',
    email: 'bart@wetarget.nl',
    phone_mobile: '+31612345678',
    linkedin_url: 'https://linkedin.com/in/bart',
    source_origin: ['apollo'],
  }

  it('zet name, org_id, owner_id, email en phone', () => {
    const p = buildPersonPayload(contact, 999, owner)
    expect(p.name).toBe('Bart van der Klaauw')
    expect(p.org_id).toBe(999)
    expect(p.owner_id).toBe(22971285)
    expect(p.email).toEqual([{ value: 'bart@wetarget.nl', primary: true }])
    expect(p.phone).toEqual([{ value: '+31612345678', primary: true }])
  })

  it('zet alleen functie+linkedin custom-fields als aanwezig', () => {
    const p = buildPersonPayload({ ...contact, title: undefined, linkedin_url: undefined }, 999, owner)
    // FUNCTIE en LINKEDIN keys moeten niet aanwezig zijn — als ze aanwezig zouden zijn,
    // staan ze als top-level keys in p (samen met name, org_id, etc.)
    // We controleren door te kijken of er extra keys zijn naast de standaard
    const standardKeys = new Set(['name', 'org_id', 'owner_id', 'visible_to', 'email', 'phone'])
    const extra = Object.keys(p).filter((k) => !standardKeys.has(k))
    expect(extra).toHaveLength(0)
  })

  it('werkt zonder email/phone', () => {
    const p = buildPersonPayload(
      { name: 'X', source_origin: ['kvk'] } as NormalizedContact,
      1,
      owner,
    )
    expect(p.email).toBeUndefined()
    expect(p.phone).toBeUndefined()
  })

  it('valt terug op info@-adres als contact geen email heeft maar companyDomain wel', () => {
    const p = buildPersonPayload(
      { name: 'X', source_origin: ['kvk'] } as NormalizedContact,
      1,
      owner,
      { companyDomain: 'wetarget.nl' },
    )
    expect(p.email).toEqual([{ value: 'info@wetarget.nl', primary: true }])
  })

  it('valt terug op company-phone als contact geen mobile/other heeft', () => {
    const p = buildPersonPayload(
      { name: 'X', source_origin: ['kvk'] } as NormalizedContact,
      1,
      owner,
      { companyPhone: '+31 174 257 221' },
    )
    expect(p.phone).toEqual([{ value: '+31 174 257 221', primary: true }])
  })

  it('contact.phone_mobile heeft voorrang op company-phone', () => {
    const p = buildPersonPayload(
      { name: 'X', phone_mobile: '+31612345678', source_origin: ['apollo'] } as NormalizedContact,
      1,
      owner,
      { companyPhone: '+31 174 257 221' },
    )
    expect(p.phone).toEqual([{ value: '+31612345678', primary: true }])
  })
})

describe('buildDealPayload', () => {
  it('bouwt deal met title, owner, person_id, org_id, contactmoment', () => {
    const p = buildDealPayload(masterFull, 100, 200, owner, '2026-05-08')
    expect(p.title).toMatch(/WeTarget B\.V\./)
    expect(p.title).toMatch(/2026-05-/)
    expect(p.org_id).toBe(100)
    expect(p.person_id).toBe(200)
    expect(p.pipeline_id).toBe(11)
    expect(p.stage_id).toBe(66)
    expect(p.custom_fields?.['6b624a58761cbbd7a95363c1a5c969daa172563c']).toBe('2026-05-08')
  })

  it('skipt contactmoment-field als config het niet heeft', () => {
    const p = buildDealPayload(
      masterFull,
      100,
      200,
      { ...owner, contactmoment_field_key: null },
      '2026-05-08',
    )
    expect(p.custom_fields).toEqual({})
  })

  it('werkt zonder primary person', () => {
    const p = buildDealPayload(masterFull, 100, undefined, owner, '2026-05-08')
    expect(p.person_id).toBeUndefined()
  })
})

describe('nextWorkday', () => {
  it('skipt zaterdag/zondag', () => {
    // Vrijdag 2026-05-08 → +1 werkdag = ma 2026-05-11
    expect(nextWorkday(new Date('2026-05-08T10:00:00Z'), 1)).toBe('2026-05-11')
  })
  it('+0 werkdagen geeft zelfde datum (in UTC-day)', () => {
    expect(nextWorkday(new Date('2026-05-07T10:00:00Z'), 0)).toBe('2026-05-07')
  })
  it('+3 vanaf maandag = donderdag', () => {
    expect(nextWorkday(new Date('2026-05-04T10:00:00Z'), 3)).toBe('2026-05-07')
  })
  it('+1 vanaf zaterdag = maandag', () => {
    expect(nextWorkday(new Date('2026-05-09T10:00:00Z'), 1)).toBe('2026-05-11')
  })
})
