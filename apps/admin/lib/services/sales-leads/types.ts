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
  source_origin: Array<'apollo' | 'website' | 'kvk' | 'manual'>
  is_warm_lead?: boolean
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
  pages_crawled?: Array<{ path: string; title: string; word_count: number }>
  blog_post_count?: number
  blog_last_post_date?: string

  // Career-page
  career_page_url?: string
  career_page_method?: 'sitemap' | 'robots' | 'common_path' | 'html_link' | 'manual'
  career_page_external?: boolean
  career_page_ats_type?: string
  career_page_last_seen?: string

  // Lead-output
  contacts?: NormalizedContact[]
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
