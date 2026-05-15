import { cachedFetch } from './cache'
import type { NormalizedFields, NormalizedSbiActivity, SourceHealth } from './types'
import { sbiToBrancheLabel } from '@/lib/constants/sbi-mapping'

const KVK_BASE = process.env.KVK_API_BASE_URL ?? 'https://api.kvk.nl/api'

// Raw KvK API shapes — alleen wat we gebruiken.

type KvkZoekenAdres = {
  straatnaam?: string
  huisnummer?: number
  huisnummerToevoeging?: string
  postcode?: string
  plaats?: string
  land?: string
}

type KvkZoekResultaat = {
  kvkNummer: string
  vestigingsnummer?: string
  naam: string
  type: 'hoofdvestiging' | 'nevenvestiging' | 'rechtspersoon'
  actief?: 'Yes' | 'No'
  adres?: KvkZoekenAdres
}

type KvkZoekResponse = {
  pagina: number
  resultatenPerPagina: number
  totaal: number
  resultaten: KvkZoekResultaat[]
}

type KvkAdres = KvkZoekenAdres & { volledigAdres?: string; addresseerbaarObjectId?: string }

type KvkVestiging = {
  vestigingsnummer?: string
  adressen?: KvkAdres[]
  websites?: string[]
  emailadressen?: string[]
  telefoonnummers?: Array<{ nummer: string }>
  geoData?: { gpsLatitude?: number; gpsLongitude?: number; addresseerbaarObjectId?: string }
}

type KvkBasisprofiel = {
  kvkNummer: string
  rsin?: string
  statutaireNaam?: string
  formeleRegistratiedatum?: string
  totaalWerkzamePersonen?: number
  sbiActiviteiten?: Array<{ sbiCode: string; sbiOmschrijving: string; indHoofdactiviteit: 'Ja' | 'Nee' }>
  handelsnamen?: Array<{ naam: string; volgorde?: number }>
  _embedded?: {
    eigenaar?: { rechtsvorm?: string; uitgebreideRechtsvorm?: string }
    hoofdvestiging?: KvkVestiging
    vestigingen?: KvkVestiging[]
  }
}

export class KvkApiError extends Error {
  constructor(public httpStatus: number, public reason: 'not_found' | 'rate_limited' | 'invalid_key' | 'server_error' | 'unknown', message: string) {
    super(message)
    this.name = 'KvkApiError'
  }
}

export class KvkService {
  private readonly apiKey = process.env.KVK_API_KEY

  private headers() {
    if (!this.apiKey) throw new KvkApiError(0, 'invalid_key', 'KVK_API_KEY ontbreekt')
    return { apikey: this.apiKey, accept: 'application/json' }
  }

  private async kvkFetch<T>(path: string): Promise<T> {
    const url = `${KVK_BASE}${path}`
    let lastErr: unknown = null
    const delays = [0, 1000, 4000, 9000] // initial + 3 retries
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]))
      try {
        const res = await fetch(url, { headers: this.headers(), cache: 'no-store' })
        if (res.status === 404) throw new KvkApiError(404, 'not_found', `KvK 404: ${path}`)
        if (res.status === 401) throw new KvkApiError(401, 'invalid_key', 'KvK 401 — invalid api-key')
        if (res.status === 429) {
          if (i === delays.length - 1) throw new KvkApiError(429, 'rate_limited', 'KvK 429 na 3 retries')
          continue
        }
        if (res.status >= 500) {
          if (i === delays.length - 1) throw new KvkApiError(res.status, 'server_error', `KvK ${res.status}`)
          continue
        }
        if (!res.ok) throw new KvkApiError(res.status, 'unknown', `KvK ${res.status}`)
        return (await res.json()) as T
      } catch (e) {
        lastErr = e
        if (e instanceof KvkApiError && (e.reason === 'not_found' || e.reason === 'invalid_key')) throw e
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('KvK failed')
  }

  /**
   * Zoek bedrijven op naam (whole-text match, geen fuzzy). Prefer `type=hoofdvestiging`.
   * Returnt max 10 actieve resultaten.
   */
  async searchByName(naam: string): Promise<KvkZoekResultaat[]> {
    const { value } = await cachedFetch('kvk_zoeken', `naam:${naam.toLowerCase().trim()}`, '7d', async () => {
      // NB: KvK Zoeken v2 ondersteunt de `actief` query-param niet meer (geeft 400
      // met fout-code IPD1999). We filteren `actief=Yes` daarom client-side.
      const params = new URLSearchParams({ naam, resultatenPerPagina: '10' })
      const data = await this.kvkFetch<KvkZoekResponse>(`/v2/zoeken?${params.toString()}`)
      const all = data.resultaten ?? []
      return all.filter((r) => r.actief !== 'No')
    })
    return value
  }

  /**
   * Haal volledig basisprofiel op voor 1 KvK-nummer (incl. geoData voor lat/lng + BAG-id).
   */
  async getBasisprofiel(kvkNummer: string): Promise<KvkBasisprofiel> {
    const { value } = await cachedFetch('kvk_basisprofiel', kvkNummer, '7d', async () => {
      return this.kvkFetch<KvkBasisprofiel>(`/v1/basisprofielen/${kvkNummer}?geoData=true`)
    })
    return value
  }

  /**
   * Hoofdroute: vind hoofdvestiging op een bedrijfsnaam-guess (uit domein of input) en
   * map naar `NormalizedFields`. Gooit `KvkApiError(404,'not_found',...)` als geen match.
   */
  async enrichByName(naam: string): Promise<NormalizedFields> {
    const matches = await this.searchByName(naam)
    if (matches.length === 0) throw new KvkApiError(404, 'not_found', `Geen KvK-match voor "${naam}"`)
    // Voorkeur: hoofdvestiging > rechtspersoon > nevenvestiging
    const order = { hoofdvestiging: 0, rechtspersoon: 1, nevenvestiging: 2 } as const
    const best = [...matches].sort((a, b) => order[a.type] - order[b.type])[0]
    const profiel = await this.getBasisprofiel(best.kvkNummer)
    return this.mapBasisprofielToNormalized(profiel, best)
  }

  /**
   * Directe lookup op KvK-nummer (8 cijfers). Skipt de Zoeken-stap volledig.
   * Gebruikt door de orchestrator-retry wanneer Mistral een KvK-nummer letterlijk
   * op de website heeft gevonden — sterker signaal dan een naam-zoektocht.
   */
  async enrichByKvkNumber(kvkNummer: string): Promise<NormalizedFields> {
    const profiel = await this.getBasisprofiel(kvkNummer)
    return this.mapBasisprofielToNormalized(profiel)
  }

  private mapBasisprofielToNormalized(p: KvkBasisprofiel, hit?: KvkZoekResultaat): NormalizedFields {
    const hoofd = p._embedded?.hoofdvestiging
    const adresArr = hoofd?.adressen ?? []
    const bezoek = adresArr[0] // KvK levert eerst bezoek-, dan post-adres
    const sbi: NormalizedSbiActivity[] = (p.sbiActiviteiten ?? []).map((s) => ({
      code: s.sbiCode,
      description: s.sbiOmschrijving,
      is_main: s.indHoofdactiviteit === 'Ja',
    }))
    const mainSbi = sbi.find((s) => s.is_main)
    const phones = (hoofd?.telefoonnummers ?? []).map((t) => t.nummer).filter(Boolean)
    const emails = (hoofd?.emailadressen ?? []).filter(Boolean)
    const websites = (hoofd?.websites ?? []).filter(Boolean)
    const lat = hoofd?.geoData?.gpsLatitude
    const lng = hoofd?.geoData?.gpsLongitude

    const employee_count = p.totaalWerkzamePersonen
    const employee_bucket: NormalizedFields['employee_bucket'] | undefined =
      employee_count == null
        ? undefined
        : employee_count < 10
        ? 'klein_<10'
        : employee_count < 100
        ? 'middel_<100'
        : 'groot_>100'

    return {
      company_name: p.statutaireNaam ?? hit?.naam,
      trade_names: (p.handelsnamen ?? []).map((h) => h.naam),
      legal_form: p._embedded?.eigenaar?.uitgebreideRechtsvorm ?? p._embedded?.eigenaar?.rechtsvorm,
      kvk_number: p.kvkNummer,
      rsin: p.rsin,
      vestigingsnummer: hoofd?.vestigingsnummer,
      address: bezoek
        ? {
            street: bezoek.straatnaam,
            number:
              bezoek.huisnummer != null
                ? `${bezoek.huisnummer}${bezoek.huisnummerToevoeging ?? ''}`.trim()
                : undefined,
            postcode: bezoek.postcode,
            city: bezoek.plaats,
            country: bezoek.land ?? 'Nederland',
            full: bezoek.volledigAdres,
          }
        : undefined,
      coordinates: lat != null && lng != null ? { lat, lng } : undefined,
      bag_id: hoofd?.geoData?.addresseerbaarObjectId,
      website: websites[0],
      email: emails[0],
      emails_all: emails.length ? emails : undefined,
      phone: phones[0],
      phones_all: phones.length ? phones : undefined,
      industry: mainSbi ? sbiToBrancheLabel(mainSbi.code) : undefined,
      sbi_activities: sbi.length ? sbi : undefined,
      employee_count,
      employee_bucket,
      founded_year: (() => {
        const y = p.formeleRegistratiedatum ? Number(p.formeleRegistratiedatum.slice(0, 4)) : NaN
        return Number.isFinite(y) ? y : undefined
      })(),
      founded_date: p.formeleRegistratiedatum,
      source: 'kvk',
    }
  }

  async health(): Promise<SourceHealth> {
    const t0 = Date.now()
    try {
      // Light call: zoek op vaste KvK 87886022 (WeTarget) — minst kwetsbaar
      const data = await this.kvkFetch<KvkZoekResponse>('/v2/zoeken?kvkNummer=87886022')
      return {
        ok: data.totaal > 0,
        latency_ms: Date.now() - t0,
        message: data.totaal > 0 ? undefined : 'Onverwachte 0 resultaten',
      }
    } catch (e) {
      const msg = e instanceof KvkApiError ? `${e.reason} (${e.httpStatus})` : String(e)
      return { ok: false, latency_ms: Date.now() - t0, message: msg }
    }
  }
}
