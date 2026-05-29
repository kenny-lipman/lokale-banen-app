// Discovery-shared shapes
export type DiscoveredRole =
  | 'home'
  | 'contact'
  | 'about'
  | 'team'
  | 'careers'
  | 'company'
  | 'other'

export type CareerPageMethod =
  | 'sitemap'
  | 'robots'
  | 'common_path'
  | 'html_link'
  | 'subdomain_probe'
  | 'manual'

// Pipedrive-metadata shapes (subset van wat /v1 returnt; alleen wat de UI nodig heeft)

export type PipedriveUser = {
  id: number
  name: string
  email: string
  active_flag: boolean
}

export type PipedrivePipeline = {
  id: number
  name: string
  active: boolean
  order_nr: number
}

export type PipedriveStage = {
  id: number
  name: string
  pipeline_id: number
  order_nr: number
}

export type PipedriveDealField = {
  key: string // 40-char hash (custom) of standaard naam
  name: string
  field_type: string // 'date' | 'enum' | 'varchar' | ...
  edit_flag: boolean
  mandatory_flag: boolean
}

// Owner-config validation result
export type OwnerConfigTestResult = {
  ok: boolean
  checks: {
    user: { ok: boolean; message?: string }
    pipeline: { ok: boolean; message?: string }
    stage: { ok: boolean; message?: string }
    deal_field: { ok: boolean; message?: string }
  }
}

// ─── Per-source enrichment shape (sectie 4.1 spec) ──────────────────────────

export type EnrichmentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'not_found'

export type PerSourceEnrichment = {
  status: EnrichmentStatus
  started_at?: string
  completed_at?: string
  raw?: unknown
  parsed?: NormalizedFields
  /**
   * Alternatieve top-N candidates voor sources die multi-result ondersteunen.
   * V1: alleen `google_maps` (Apify levert top-3). User kan via UI een ander
   * candidate als primair selecteren — `parsed` wordt dan vervangen.
   */
  candidates?: NormalizedFields[]
  /** Index in `candidates[]` die nu actief is als `parsed`. Default 0. */
  selected_candidate_index?: number
  error?: string
}

// ─── NormalizedFields (sectie 4.2 spec) ─────────────────────────────────────

export type NormalizedAddress = {
  street?: string
  number?: string
  postcode?: string
  city?: string
  country?: string
  full?: string
}

export type NormalizedSbiActivity = {
  code: string
  description: string
  is_main: boolean
}

export type NormalizedTechnology = {
  name: string
  category: string
}

export type NormalizedContact = {
  name: string
  first_name?: string
  last_name?: string
  title?: string
  seniority?:
    | 'owner' | 'founder' | 'c_suite' | 'vp' | 'head'
    | 'director' | 'manager' | 'senior' | 'junior' | 'intern'
  department?:
    | 'executive' | 'human_resources' | 'operations' | 'sales'
    | 'marketing' | 'finance' | 'engineering' | 'other'
  email?: string
  email_verified?: boolean
  phone_mobile?: string
  phone_other?: string
  linkedin_url?: string
  ai_priority_score?: number
  ai_priority_reason?: string
  source_origin: Array<'apollo' | 'website' | 'kvk' | 'manual' | 'synthetic'>
  is_warm_lead?: boolean
}

/**
 * Cold candidate uit Apollo `/mixed_people/api_search`. Achternaam, email en
 * telefoon zijn obfuscated tot user expliciet via bulk_match verrijkt (1 credit
 * per persoon). `apollo_id` is de stabiele Apollo person-ID — gebruikt als
 * input voor `/people/bulk_match`.
 */
export type ColdContact = {
  apollo_id: string
  first_name?: string
  last_name_obfuscated?: string
  title?: string
  seniority?: NormalizedContact['seniority']
  departments?: string[]
  has_email: boolean
  has_direct_phone: 'yes' | 'maybe' | 'no'
  organization_id?: string
}

export type NormalizedVacancy = {
  title: string
  url?: string
  location?: string
  description_short?: string
  source: 'manual' | 'website_werkenbij'
}

export type NormalizedFields = {
  // Identiteit
  company_name?: string
  trade_names?: string[]
  legal_form?: string
  kvk_number?: string
  rsin?: string
  vestigingsnummer?: string

  // Locatie
  address?: NormalizedAddress
  coordinates?: { lat: number; lng: number }
  bag_id?: string

  // Web
  website?: string
  email?: string
  emails_all?: string[]
  phone?: string
  phones_all?: string[]
  linkedin_url?: string
  linkedin_uid?: string
  twitter_url?: string
  facebook_url?: string
  instagram_url?: string
  tiktok_url?: string
  crunchbase_url?: string

  // Bedrijfsprofiel
  industry?: string
  industry_codes?: string[]
  sbi_activities?: NormalizedSbiActivity[]
  employee_count?: number
  employee_bucket?: 'klein_<10' | 'middel_<100' | 'groot_>100'
  founded_year?: number
  founded_date?: string
  description_short?: string
  description_long?: string

  // Apollo-specifiek
  apollo_org_id?: string
  technologies?: NormalizedTechnology[]
  keywords?: string[]
  departmental_head_count?: Record<string, number>
  annual_revenue?: number
  funding_total?: number

  // Maps-specifiek
  rating?: number
  ratings_total?: number
  business_status?: string
  opening_hours?: string[]
  business_types?: string[]
  photos_count?: number
  logo_url?: string

  // Website-specifiek
  pages_crawled?: Array<{ path: string; title: string; word_count: number; role?: DiscoveredRole }>
  // Volledige sitemap-discovery — `fetched` markeert of de URL ook is gecrawled
  // (false = boven role-caps / boven MAX_PAGES uitgevallen). Voor UI-transparency.
  pages_discovered?: Array<{ path: string; role?: DiscoveredRole; priority: number; fetched: boolean }>
  blog_post_count?: number
  blog_last_post_date?: string

  // Career-page (legacy: 1e gefetched career-URL)
  career_page_url?: string
  career_page_method?: CareerPageMethod
  career_page_external?: boolean
  career_page_ats_type?: string
  career_page_last_seen?: string

  /**
   * Alle discovered URLs met role='careers' (ook niet-gefetched). Wordt gebruikt door
   * enrichment-orchestrator om bij run-completion potentiële career-page-bronnen
   * aan te maken in `job_sources` met review_status='pending'.
   */
  career_page_candidates?: Array<{ url: string; method: CareerPageMethod; role: 'careers' }>

  // Lead-output
  contacts?: NormalizedContact[]
  /**
   * Apollo cold suggesties (uit `/mixed_people/api_search`, 0 credits). Worden
   * pas naar `contacts` gepromoveerd nadat user ze via reveal-flow verrijkt.
   */
  cold_candidates?: ColdContact[]
  vacancies?: NormalizedVacancy[]

  // Bron-attribution
  source?: 'kvk' | 'google_maps' | 'apollo' | 'website'
}

// ─── Audit-log entry shape (sectie 10.1 spec) ──────────────────────────────

export type AuditLogEntry = {
  ts: string
  source: 'kvk' | 'google_maps' | 'apollo' | 'website' | 'mistral' | 'pipedrive'
  endpoint: string
  duration_ms: number
  status: 'ok' | 'failed' | 'rate_limited' | 'cached' | 'not_found'
  http_status?: number
  error?: string
  cost_credits?: number
}

// ─── Health-check shape (sectie 10.3 spec) ─────────────────────────────────

export type SourceHealth = {
  ok: boolean
  latency_ms: number
  message?: string
  credits_remaining?: number
}

// ─── Run-enrichments shape (sectie 4.1 spec) ────────────────────────────────

export type RunEnrichments = {
  kvk?: PerSourceEnrichment
  google_maps?: PerSourceEnrichment
  apollo?: PerSourceEnrichment
  website?: PerSourceEnrichment
}

export type SourceKey = 'kvk' | 'google_maps' | 'apollo' | 'website' | 'custom'

// ─── Master record (sectie 4.3 spec) ────────────────────────────────────────

export type MasterRecord = NormalizedFields & {
  // Per-veld bron-attributie. Niet alle NormalizedFields keys hoeven hier in
  // (alleen velden waar daadwerkelijk een bron is gekozen).
  source_overrides: Partial<Record<keyof NormalizedFields, SourceKey>>
  hoofddomein: string | null
  deal_note_text: string
  /**
   * Mistral branche-classificatie. Gevuld in `EnrichmentOrchestrator.finalize()`.
   * `enum_id` matcht `pipedrive_branche_options.pipedrive_enum_id`. `confidence`
   * is 0-100 (uit Mistral). Wordt als 2e prioriteit gebruikt bij sync, na
   * eventuele user-override op `sales_lead_runs.branche_override`.
   */
  branche_suggestion?: {
    enum_id: number
    label: string
    confidence: number
    reasoning: string
  } | null
}

// ─── Contact-ranking output (sectie 7.2 spec) ──────────────────────────────

export type ContactRankingPick = {
  name: string
  score: number
  reason: string
}

export type ContactRankingResult = {
  person_1: ContactRankingPick | null
  person_2: ContactRankingPick | null
  fallback_used: boolean
}

// ─── Run-detail-response shape (voor GET /api/sales-leads/{id}) ────────────

export type SalesLeadRunStatus =
  | 'enriching'
  | 'review'
  | 'syncing'
  | 'completed'
  | 'failed'
  | 'duplicate'

export type RunDetailResponse = {
  run: {
    id: string
    status: SalesLeadRunStatus
    input_url: string
    input_domain: string
    owner_config_id: string
    scrape_vacancies: boolean
    manual_vacancies: NormalizedVacancy[]
    enrichments: RunEnrichments
    master_record: MasterRecord | null
    selected_contacts: NormalizedContact[]
    pipedrive_org_id: number | null
    pipedrive_deal_id: number | null
    pipedrive_person_ids: number[]
    existing_pipedrive_org_id: number | null
    branche_override: number | null
    contactmoment_override: string | null
    error: string | null
    created_at: string
    updated_at: string
  }
}

// ─── Run-list response shape (voor GET /api/sales-leads) ───────────────────

export type RunListItem = {
  id: string
  status: SalesLeadRunStatus
  input_domain: string
  input_url: string
  owner_config_id: string
  owner_label: string | null
  master_record: MasterRecord | null
  pipedrive_org_id: number | null
  pipedrive_deal_id: number | null
  error: string | null
  created_at: string
}

export type RunListResponse = {
  runs: RunListItem[]
  total: number
}
