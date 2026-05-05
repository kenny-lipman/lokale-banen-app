import type {
  RunEnrichments,
  NormalizedFields,
  MasterRecord,
  SourceKey,
} from './types'

type SourcePriority = Array<Exclude<SourceKey, 'custom'>>

/**
 * Bron-prioriteit per veld (sectie 6.4 spec). Eerste bron met een non-empty
 * waarde wint. `industry` wijkt af: Apollo wint over KvK SBI bij conflict
 * (sales-relevanter), zie spec.
 */
const FIELD_PRIORITY: Partial<Record<keyof NormalizedFields, SourcePriority>> = {
  company_name: ['kvk', 'apollo', 'website'],
  kvk_number: ['kvk', 'website'],
  rsin: ['kvk'],
  vestigingsnummer: ['kvk'],
  trade_names: ['kvk'],
  legal_form: ['kvk'],
  address: ['google_maps', 'kvk', 'website'],
  coordinates: ['google_maps', 'kvk'],
  bag_id: ['kvk'],
  phone: ['kvk', 'apollo', 'website'],
  phones_all: ['kvk', 'apollo', 'website'],
  email: ['kvk', 'website'],
  emails_all: ['kvk', 'website'],
  website: ['apollo', 'kvk', 'website'],
  linkedin_url: ['apollo'],
  twitter_url: ['apollo', 'website'],
  facebook_url: ['apollo', 'website'],
  instagram_url: ['website'],
  tiktok_url: ['website'],
  crunchbase_url: ['apollo'],
  industry: ['apollo', 'kvk'],
  industry_codes: ['apollo'],
  sbi_activities: ['kvk'],
  employee_count: ['kvk', 'apollo'],
  employee_bucket: ['kvk', 'apollo'],
  founded_year: ['kvk', 'apollo'],
  founded_date: ['kvk'],
  description_short: ['apollo', 'website'],
  description_long: ['apollo'],
  apollo_org_id: ['apollo'],
  technologies: ['apollo'],
  keywords: ['apollo'],
  departmental_head_count: ['apollo'],
  annual_revenue: ['apollo'],
  funding_total: ['apollo'],
  rating: ['google_maps'],
  ratings_total: ['google_maps'],
  business_status: ['google_maps'],
  opening_hours: ['google_maps'],
  business_types: ['google_maps'],
  photos_count: ['google_maps'],
  career_page_url: ['website'],
  career_page_method: ['website'],
  career_page_external: ['website'],
  career_page_ats_type: ['website'],
}

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

/**
 * Bouwt een initieel master_record door per veld de eerste bron met
 * non-empty waarde te kiezen (volgens FIELD_PRIORITY).
 *
 * `inputUrl` overschrijft `website` veld (klant brief: "(input URL)" is primair).
 * `hoofddomein` is null hier — wordt later gevuld door PlatformMatcherService
 * (fase 5) of door owner_config.hoofddomein_fixed_value.
 */
export function computePrimaryMaster(
  enrichments: RunEnrichments,
  inputUrl: string,
): MasterRecord {
  const sourceParsed: Record<Exclude<SourceKey, 'custom'>, NormalizedFields | undefined> = {
    kvk: enrichments.kvk?.parsed,
    google_maps: enrichments.google_maps?.parsed,
    apollo: enrichments.apollo?.parsed,
    website: enrichments.website?.parsed,
  }

  const result: NormalizedFields = {}
  const sourceOverrides: MasterRecord['source_overrides'] = {}

  for (const [field, priority] of Object.entries(FIELD_PRIORITY) as Array<
    [keyof NormalizedFields, SourcePriority]
  >) {
    for (const src of priority) {
      const parsed = sourceParsed[src]
      if (!parsed) continue
      const v = parsed[field]
      if (!isPresent(v)) continue
      // ts-narrowing: assignment via unknown
      ;(result as Record<string, unknown>)[field] = v
      sourceOverrides[field] = src
      break
    }
  }

  // input URL altijd primair voor `website` (klant brief)
  if (inputUrl) {
    const norm = inputUrl.trim().startsWith('http')
      ? inputUrl.trim()
      : `https://${inputUrl.trim()}`
    result.website = norm
    sourceOverrides.website = 'custom'
  }

  // Contacts/vacancies komen niet uit FIELD_PRIORITY — die worden door de
  // orchestrator (rankContacts + dedupe) los gevuld in selected_contacts.
  // Hier alleen de website-eigen vacancies meenemen voor de master-context.
  if (sourceParsed.website?.vacancies?.length) {
    result.vacancies = sourceParsed.website.vacancies
    sourceOverrides.vacancies = 'website'
  }

  return {
    ...result,
    source_overrides: sourceOverrides,
    hoofddomein: null,
    deal_note_text: '',
  }
}

/**
 * Detecteer waardes die per bron afwijken (industry, founded_year, address.city).
 * Gebruikt door UI om gele warning-blokken te tonen (sectie 5.2.2).
 */
export type Discrepancy = {
  field: keyof NormalizedFields
  values: Array<{ source: Exclude<SourceKey, 'custom'>; value: unknown }>
}

const DISCREPANCY_FIELDS: Array<keyof NormalizedFields> = [
  'industry',
  'founded_year',
  'company_name',
  'employee_count',
]

export function detectDiscrepancies(enrichments: RunEnrichments): Discrepancy[] {
  const sources: Array<{ key: Exclude<SourceKey, 'custom'>; parsed: NormalizedFields | undefined }> = [
    { key: 'kvk', parsed: enrichments.kvk?.parsed },
    { key: 'google_maps', parsed: enrichments.google_maps?.parsed },
    { key: 'apollo', parsed: enrichments.apollo?.parsed },
    { key: 'website', parsed: enrichments.website?.parsed },
  ]
  const out: Discrepancy[] = []
  for (const field of DISCREPANCY_FIELDS) {
    const values = sources
      .map((s) => ({ source: s.key, value: s.parsed?.[field] }))
      .filter((v) => isPresent(v.value))
    const unique = new Set(values.map((v) => JSON.stringify(v.value)))
    if (unique.size > 1) out.push({ field, values })
  }
  return out
}
