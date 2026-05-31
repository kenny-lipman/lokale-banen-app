import { describe, it, expect, vi } from 'vitest'
import {
  PipedriveSyncService,
  computeExistingOrgFlow,
} from '@/lib/services/sales-leads/pipedrive-sync.service'

/**
 * Unit-tests voor de robuustheids-logica van de Pipedrive-sync: contact-dedup
 * (exacte e-mailmatch + org-koppeling), lege-velden-aanvulling van een bestaande
 * org, en de afgeleide retry-modus. De Pipedrive-client wordt geinjecteerd als
 * in-memory fake; er gaat geen enkele call naar de echte API.
 */

// Minimale fake-client; per test overschrijven we de relevante methods.
function makeService(pd: Record<string, unknown>) {
  // supabase wordt in deze tests niet geraakt (we roepen alleen private helpers
  // aan), dus een leeg object volstaat.
  const service = new PipedriveSyncService(
    {} as never,
    pd as never,
  )
  return service as unknown as {
    fillEmptyOrgFields: (orgId: number, desired: unknown) => Promise<void>
    findExistingPersonByEmail: (
      email: string | null | undefined,
    ) => Promise<{ id: number; shouldLinkOrg: boolean } | null>
  }
}

describe('computeExistingOrgFlow (retry-modus)', () => {
  it("is true bij expliciete 'existing'-keuze", () => {
    expect(computeExistingOrgFlow('existing', null, null)).toBe(true)
    expect(computeExistingOrgFlow('existing', 5, 999)).toBe(true)
  })

  it("leidt 'existing' af bij auto-retry waar org === duplicate-org", () => {
    expect(computeExistingOrgFlow('auto', 20889, 20889)).toBe(true)
  })

  it('is false bij auto zonder gekoppelde org of bij een nieuwe org', () => {
    expect(computeExistingOrgFlow('auto', null, 20889)).toBe(false)
    expect(computeExistingOrgFlow('auto', 30000, 20889)).toBe(false)
    expect(computeExistingOrgFlow('auto', null, null)).toBe(false)
  })

  it("is false voor 'new'", () => {
    expect(computeExistingOrgFlow('new', 20889, 20889)).toBe(false)
  })
})

describe('findExistingPersonByEmail (exacte match + org-koppeling)', () => {
  it('matcht exact (case-insensitive) en koppelt org als persoon geen org heeft', async () => {
    const updatePerson = vi.fn()
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        { item: { id: 42, emails: ['Jan@Bedrijf.NL'] } },
      ]),
      getPerson: vi.fn().mockResolvedValue({ id: 42, org_id: null }),
      updatePerson,
    })
    const res = await service.findExistingPersonByEmail('jan@bedrijf.nl')
    expect(res).toEqual({ id: 42, shouldLinkOrg: true })
  })

  it('koppelt org NIET als persoon al een andere org heeft', async () => {
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        { item: { id: 7, emails: [{ value: 'piet@x.nl', primary: true }] } },
      ]),
      getPerson: vi.fn().mockResolvedValue({ id: 7, org_id: 555 }),
    })
    const res = await service.findExistingPersonByEmail('piet@x.nl')
    expect(res).toEqual({ id: 7, shouldLinkOrg: false })
  })

  it('negeert een fuzzy hit die niet exact matcht', async () => {
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        { item: { id: 1, emails: ['ander@bedrijf.nl'] } },
      ]),
      getPerson: vi.fn(),
    })
    const res = await service.findExistingPersonByEmail('jan@bedrijf.nl')
    expect(res).toBeNull()
  })

  it('vindt de exacte match ook als die niet het eerste resultaat is', async () => {
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        { item: { id: 1, emails: ['ander@bedrijf.nl'] } },
        { item: { id: 2, primary_email: 'jan@bedrijf.nl' } },
      ]),
      getPerson: vi.fn().mockResolvedValue({ id: 2 }), // geen org-veld -> unknown
    })
    const res = await service.findExistingPersonByEmail('jan@bedrijf.nl')
    expect(res).toEqual({ id: 2, shouldLinkOrg: false })
  })

  it('geeft null bij lege of ontbrekende e-mail (geen dedup op info@-fallback)', async () => {
    const search = vi.fn()
    const service = makeService({ searchPersonByEmail: search, getPerson: vi.fn() })
    expect(await service.findExistingPersonByEmail(null)).toBeNull()
    expect(await service.findExistingPersonByEmail('')).toBeNull()
    expect(await service.findExistingPersonByEmail('   ')).toBeNull()
    expect(search).not.toHaveBeenCalled()
  })

  it('geeft null als de search faalt', async () => {
    const service = makeService({
      searchPersonByEmail: vi.fn().mockRejectedValue(new Error('boom')),
      getPerson: vi.fn(),
    })
    expect(await service.findExistingPersonByEmail('jan@bedrijf.nl')).toBeNull()
  })

  it('koppelt org NIET als getPerson faalt (onbekend -> niet overschrijven)', async () => {
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        { item: { id: 9, emails: ['jan@bedrijf.nl'] } },
      ]),
      getPerson: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const res = await service.findExistingPersonByEmail('jan@bedrijf.nl')
    expect(res).toEqual({ id: 9, shouldLinkOrg: false })
  })

  // Echte V2 search-item-vorm: organization zit al in het item.
  it('gebruikt organization uit het search-item en roept getPerson NIET aan', async () => {
    const getPerson = vi.fn()
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        {
          item: {
            id: 64752,
            emails: ['jvdweel@koppert.nl'],
            primary_email: 'jvdweel@koppert.nl',
            organization: { id: 24897, name: 'Koppert' },
          },
        },
      ]),
      getPerson,
    })
    const res = await service.findExistingPersonByEmail('jvdweel@koppert.nl')
    expect(res).toEqual({ id: 64752, shouldLinkOrg: false })
    expect(getPerson).not.toHaveBeenCalled()
  })

  it('herkent organization:null in het item als "geen org" (link, geen getPerson)', async () => {
    const getPerson = vi.fn()
    const service = makeService({
      searchPersonByEmail: vi.fn().mockResolvedValue([
        { item: { id: 5, emails: ['x@y.nl'], organization: null } },
      ]),
      getPerson,
    })
    const res = await service.findExistingPersonByEmail('x@y.nl')
    expect(res).toEqual({ id: 5, shouldLinkOrg: true })
    expect(getPerson).not.toHaveBeenCalled()
  })
})

describe('fillEmptyOrgFields (alleen lege velden aanvullen)', () => {
  const desired = {
    name: 'Wollebrand B.V.',
    owner_id: 1,
    visible_to: 3,
    address: { value: 'Straat 1, 2685 Poeldijk' },
    industry: 5,
    employee_count: 20,
    custom_fields: {
      kvk: 12345678,
      hoofddomein: 111, // al gevuld op bestaande org -> niet overschrijven
      telefoon: '+31 1',
    },
  }

  it('vult lege velden aan en laat gevulde velden ongemoeid', async () => {
    const updateOrganizationV2 = vi.fn().mockResolvedValue({ id: 100 })
    const service = makeService({
      getOrganizationV2: vi.fn().mockResolvedValue({
        id: 100,
        address: null, // leeg -> aanvullen
        industry: 9, // gevuld -> behouden
        employee_count: null, // leeg -> aanvullen
        custom_fields: {
          kvk: null, // leeg -> aanvullen
          hoofddomein: 222, // gevuld -> behouden
          // telefoon ontbreekt -> aanvullen
        },
      }),
      updateOrganizationV2,
    })
    await service.fillEmptyOrgFields(100, desired)

    expect(updateOrganizationV2).toHaveBeenCalledTimes(1)
    const patch = updateOrganizationV2.mock.calls[0][1]
    expect(patch.address).toEqual({ value: 'Straat 1, 2685 Poeldijk' })
    expect(patch.employee_count).toBe(20)
    expect('industry' in patch).toBe(false) // al gevuld
    expect(patch.custom_fields).toEqual({ kvk: 12345678, telefoon: '+31 1' })
    expect('hoofddomein' in patch.custom_fields).toBe(false) // al gevuld
  })

  it('doet geen PATCH als er niets aan te vullen valt', async () => {
    const updateOrganizationV2 = vi.fn()
    const service = makeService({
      getOrganizationV2: vi.fn().mockResolvedValue({
        id: 100,
        address: { value: 'bestaat' },
        industry: 5,
        employee_count: 20,
        custom_fields: { kvk: 999, hoofddomein: 222, telefoon: 'x' },
      }),
      updateOrganizationV2,
    })
    await service.fillEmptyOrgFields(100, desired)
    expect(updateOrganizationV2).not.toHaveBeenCalled()
  })

  it('behandelt V2-vormen: leeg address-object (value:null) -> aanvullen; array-veld gevuld -> behouden', async () => {
    const desiredWithArray = {
      ...desired,
      custom_fields: { ...desired.custom_fields, categorie: [1, 2, 3] },
    }
    const updateOrganizationV2 = vi.fn().mockResolvedValue({ id: 100 })
    const service = makeService({
      getOrganizationV2: vi.fn().mockResolvedValue({
        id: 100,
        // Realistische V2-vorm: address-object met lege value.
        address: { value: null, formatted_address: null },
        industry: null,
        employee_count: null,
        custom_fields: {
          kvk: null,
          hoofddomein: 222,
          telefoon: null,
          categorie: [387, 397, 417], // multi-select gevuld -> behouden
        },
      }),
      updateOrganizationV2,
    })
    await service.fillEmptyOrgFields(100, desiredWithArray)

    expect(updateOrganizationV2).toHaveBeenCalledTimes(1)
    const patch = updateOrganizationV2.mock.calls[0][1]
    // Leeg address-object -> wel aanvullen (de bug die de inspectie blootlegde).
    expect(patch.address).toEqual({ value: 'Straat 1, 2685 Poeldijk' })
    expect(patch.industry).toBe(5)
    // Gevulde array niet overschrijven; gevulde enum (hoofddomein) niet overschrijven.
    expect('categorie' in patch.custom_fields).toBe(false)
    expect('hoofddomein' in patch.custom_fields).toBe(false)
    expect(patch.custom_fields.kvk).toBe(12345678)
    expect(patch.custom_fields.telefoon).toBe('+31 1')
  })

  it('gooit niet als getOrganizationV2 faalt (deal-koppeling gaat door)', async () => {
    const updateOrganizationV2 = vi.fn()
    const service = makeService({
      getOrganizationV2: vi.fn().mockRejectedValue(new Error('boom')),
      updateOrganizationV2,
    })
    await expect(service.fillEmptyOrgFields(100, desired)).resolves.toBeUndefined()
    expect(updateOrganizationV2).not.toHaveBeenCalled()
  })
})
