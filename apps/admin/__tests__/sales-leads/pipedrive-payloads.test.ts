import { describe, it, expect } from 'vitest'
import {
  buildOrgPayload,
  buildPersonPayload,
  buildDealPayload,
  buildAddressPayload,
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
    // masterFull.address heeft full + postcode + city -> structured payload met
    // value + postal_code + locality. Geen route/street_number/country want
    // street + number + country zitten niet in dit address-object.
    expect(p.address).toEqual({
      value: 'Slotenmakerstraat 60, 2672GD Naaldwijk',
      postal_code: '2672GD',
      locality: 'Naaldwijk',
    })
    expect(p.custom_fields).toBeDefined()
  })

  it('skipt address als geen enkel adres-veld gevuld is', () => {
    const p = buildOrgPayload({ ...masterFull, address: undefined }, owner, resolvedDefaults)
    expect(p.address).toBeUndefined()
  })

  it('composet address uit losse velden als full ontbreekt', () => {
    const p = buildOrgPayload(
      {
        ...masterFull,
        address: {
          street: 'Slotenmakerstraat',
          number: '60',
          postcode: '2672GD',
          city: 'Naaldwijk',
          country: 'Nederland',
        },
      },
      owner,
      resolvedDefaults,
    )
    // Subvelden 1-op-1 doorgeduwd voor geocoding in Pipedrive; value is de
    // samengestelde fallback-string voor display.
    expect(p.address).toEqual({
      value: 'Slotenmakerstraat 60, 2672GD Naaldwijk, Nederland',
      route: 'Slotenmakerstraat',
      street_number: '60',
      postal_code: '2672GD',
      locality: 'Naaldwijk',
      country: 'Nederland',
    })
  })

  it('zet standaard `industry`-veld op basis van custom-brancheEnumId', () => {
    const p = buildOrgPayload(masterFull, owner, { hoofddomeinOptionId: null, brancheEnumId: 293 })
    // 293 Transport → 18 (Transport, logistiek, toeleveringsketen en opslag)
    expect(p.industry).toBe(18)
  })

  it('skipt `industry` als brancheEnumId geen mapping heeft', () => {
    const p = buildOrgPayload(masterFull, owner, resolvedDefaults)
    expect(p.industry).toBeUndefined()
  })

  it('zet `employee_count` (int) wanneer master.employee_count gevuld is', () => {
    const p = buildOrgPayload({ ...masterFull, employee_count: 42 }, owner, resolvedDefaults)
    expect(p.employee_count).toBe(42)
  })

  it('skipt `employee_count` als master.employee_count ontbreekt', () => {
    const p = buildOrgPayload(masterFull, owner, resolvedDefaults)
    expect(p.employee_count).toBeUndefined()
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

  it('filtert Cloudflare email-placeholder (regular space) en valt terug op info@-fallback', () => {
    const cloudflareEmail = '[email protected]'
    const p = buildPersonPayload(
      { name: 'Dhr. Vriesde', email: cloudflareEmail, source_origin: ['website'] } as NormalizedContact,
      1,
      owner,
      { companyDomain: 'automobielbedrijf-vriesde.nl' },
    )
    expect(p.email).toEqual([{ value: 'info@automobielbedrijf-vriesde.nl', primary: true }])
  })

  it('filtert Cloudflare email-placeholder met non-breaking space U+00A0 (productie-case Vriesde)', () => {
    // De Vriesde-run had letterlijk dit byte-patroon: 'email' U+00A0 'protected'.
    // EMAIL_RE valt al om over de square brackets, maar deze test pint expliciet
    // de Cloudflare-variant met U+00A0 vast zodat we de regex-coverage borgen.
    const cloudflareEmail = '[email\u00a0protected]'
    const p = buildPersonPayload(
      { name: 'Dhr. Vriesde', email: cloudflareEmail, source_origin: ['website'] } as NormalizedContact,
      1,
      owner,
      { companyDomain: 'automobielbedrijf-vriesde.nl' },
    )
    expect(p.email).toEqual([{ value: 'info@automobielbedrijf-vriesde.nl', primary: true }])
  })

  it('filtert email zonder @ en valt terug op info@-fallback', () => {
    const p = buildPersonPayload(
      { name: 'X', email: 'kapot.email.nl', source_origin: ['website'] } as NormalizedContact,
      1,
      owner,
      { companyDomain: 'wetarget.nl' },
    )
    expect(p.email).toEqual([{ value: 'info@wetarget.nl', primary: true }])
  })

  it('laat email-veld weg als zowel contact-email als fallback invalid zijn', () => {
    const p = buildPersonPayload(
      { name: 'X', email: '[email protected]', source_origin: ['website'] } as NormalizedContact,
      1,
      owner,
    )
    expect(p.email).toBeUndefined()
  })
})

describe('buildAddressPayload', () => {
  it('returnt null voor undefined address', () => {
    expect(buildAddressPayload(undefined)).toBeNull()
  })

  it('returnt null als alle subvelden leeg zijn', () => {
    expect(buildAddressPayload({})).toBeNull()
    expect(buildAddressPayload({ full: '   ' })).toBeNull()
  })

  it('value-only payload als alleen .full aanwezig is', () => {
    expect(buildAddressPayload({ full: 'Zuideinde 140, 2991 LK Barendrecht' })).toEqual({
      value: 'Zuideinde 140, 2991 LK Barendrecht',
    })
  })

  it('alle subvelden + composed value voor volledig structured address', () => {
    expect(
      buildAddressPayload({
        street: 'Zuideinde',
        number: '140',
        postcode: '2991 LK',
        city: 'Barendrecht',
        country: 'Nederland',
      }),
    ).toEqual({
      value: 'Zuideinde 140, 2991 LK Barendrecht, Nederland',
      route: 'Zuideinde',
      street_number: '140',
      postal_code: '2991 LK',
      locality: 'Barendrecht',
      country: 'Nederland',
    })
  })

  it('partial subvelden: alleen aanwezige fields in payload', () => {
    expect(buildAddressPayload({ street: 'Hoofdstraat', city: 'Amsterdam' })).toEqual({
      value: 'Hoofdstraat, Amsterdam',
      route: 'Hoofdstraat',
      locality: 'Amsterdam',
    })
  })

  it('lege string-subvelden worden niet meegenomen', () => {
    expect(
      buildAddressPayload({
        full: 'Hoofdstraat 1, Amsterdam',
        street: '',
        number: '   ',
        city: 'Amsterdam',
      }),
    ).toEqual({
      value: 'Hoofdstraat 1, Amsterdam',
      locality: 'Amsterdam',
    })
  })
})

describe('buildDealPayload', () => {
  it('bouwt deal met title, owner, person_id, org_id, contactmoment', () => {
    const p = buildDealPayload(masterFull, 100, 200, owner, '2026-05-08')
    // De deal-titel is `${bedrijf} - ${vandaag}`, waarbij vandaag dynamisch is
    // (new Date()). Bereken de verwachte datum op dezelfde manier zodat de test
    // niet verloopt zodra de maand wisselt.
    const today = new Date().toISOString().split('T')[0]
    expect(p.title).toBe(`WeTarget B.V. - ${today}`)
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
