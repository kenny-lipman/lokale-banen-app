import { createServiceRoleClient } from '@/lib/supabase-server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeUrl } from '@/lib/utils/url'
import { detectAts } from './ats-detect'
import { detailFieldsToJobPostingUpdate } from './vacancy-detail/extract'
import type { CareerPageMethod, MasterRecord, NormalizedVacancy } from './types'

type SB = SupabaseClient

export type RunForLinking = {
  id: string
  input_domain: string
  input_url: string
  pipedrive_org_id: number | null
  master_record: MasterRecord
}

/**
 * Upsert company op (website-domain) of (kvk). Vult pipedrive_id, kvk,
 * hoofddomein, etc. als nog leeg.
 *
 * Schema-mapping notes (afwijkend van spec naam → werkelijke kolom):
 *   spec.kvk_nummer        → companies.kvk
 *   spec.apollo_org_id     → companies.apollo_organization_id
 *   spec.address           → companies.street_address
 *   spec.postcode          → companies.postal_code
 * Spec-velden NIET in companies-schema (genegeerd, niet weggeschreven):
 *   spec.domain            (geen aparte kolom — alleen `website`)
 *   spec.employee_count    (alleen `size_min`/`size_max`)
 *   spec.founded_year
 *   spec.updated_at        (geen kolom in companies — komt niet in payload)
 */
export async function upsertCompanyFromRun(
  supabase: SB,
  run: RunForLinking,
): Promise<{ id: string }> {
  const m = run.master_record
  const domain = run.input_domain
  const kvk = m.kvk_number ?? null

  // 1. Probeer match op website (volledige URL)
  const websiteCanonical = m.website ?? `https://${domain}`
  let { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('website', websiteCanonical)
    .maybeSingle()

  // 2. Fallback: match op kvk
  if (!existing && kvk) {
    const { data: byKvk } = await supabase
      .from('companies')
      .select('id')
      .eq('kvk', kvk)
      .maybeSingle()
    if (byKvk) existing = byKvk
  }

  const updates = {
    name: m.company_name ?? domain,
    website: websiteCanonical,
    kvk,
    pipedrive_id: run.pipedrive_org_id != null ? String(run.pipedrive_org_id) : null,
    hoofddomein: m.hoofddomein,
    street_address: m.address?.full ?? null,
    city: m.address?.city ?? null,
    postal_code: m.address?.postcode ?? null,
    country: m.address?.country ?? null,
    phone: m.phone ?? null,
    industry_tag_id: null as string | null, // industry: spec gebruikt vrije string; hier geen mapping naar tag-id (zou aparte lookup vragen)
    description: m.description_short ?? null,
    linkedin_url: m.linkedin_url ?? null,
    linkedin_uid: m.linkedin_uid ?? null,
    apollo_organization_id: m.apollo_org_id ?? null,
  }
  // Strip industry_tag_id (we hebben geen lookup hier — laat bestaande waarde staan)
  const { industry_tag_id: _omit, ...payload } = updates

  if (existing) {
    const { error } = await supabase.from('companies').update(payload).eq('id', existing.id)
    if (error) throw new Error(`upsertCompany update: ${error.message}`)
    return existing
  }
  const { data: inserted, error: insErr } = await supabase
    .from('companies')
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`upsertCompany insert: ${insErr?.message}`)
  return inserted
}

/**
 * Maakt een job_sources rij van kind='company_career_page' met review_status='pending'.
 * Idempotent via uniek-index (company_id, url) WHERE kind='company_career_page'.
 *
 * Niet-overschrijven gedrag:
 * - Bestaande row met review_status='rejected' → skip (anti-resuggestion)
 * - Bestaande row met review_status='approved' → skip (al actief)
 * - Bestaande row met review_status='pending'  → update metadata (run_id, method)
 *
 * URL wordt gecanonicaliseerd via normalizeUrl voor consistente dedupe.
 * Returnt null als URL niet valide is of suggestie wordt geskipt.
 */
export async function upsertCareerPageSource(
  supabase: SB,
  args: {
    company_id: string
    company_name: string
    run_id: string
    url: string
    discovery_method: CareerPageMethod
    is_external_ats: boolean
    ats_type?: string | null
  },
): Promise<{ id: string; status: 'inserted' | 'updated' | 'skipped_rejected' | 'skipped_approved' | 'skipped_invalid_url' }> {
  const canonical = normalizeUrl(args.url)
  if (!canonical) {
    return { id: '', status: 'skipped_invalid_url' }
  }

  const { data: existing } = await supabase
    .from('job_sources')
    .select('id, review_status')
    .eq('company_id', args.company_id)
    .eq('url', canonical)
    .eq('kind', 'company_career_page')
    .maybeSingle()

  // V1A.1 confidence-tier: bepaal review_status + ats velden o.b.v. URL en method.
  // ATS-detect op pre-canonical URL: normalizeUrl strip query, en sommige ATS-URLs
  // (Greenhouse embed) hebben de slug juist in de query (?for=acme).
  const tier = determineCareerPageTier(args.url, args.discovery_method)
  const now = new Date().toISOString()

  if (existing) {
    if (existing.review_status === 'rejected') {
      return { id: existing.id, status: 'skipped_rejected' }
    }
    if (existing.review_status === 'approved') {
      return { id: existing.id, status: 'skipped_approved' }
    }
    // pending → update metadata. Bij hogere-confidence info (tier='approved')
    // promoten naar approved zodat user niet alsnog moet klikken.
    const promote = tier.review_status === 'approved'
    const { error } = await supabase
      .from('job_sources')
      .update({
        discovery_method: args.discovery_method,
        is_external_ats: tier.is_external_ats,
        ats_type: tier.ats_type,
        source_run_id: args.run_id,
        updated_at: now,
        ...(promote ? { review_status: 'approved', approved_at: now } : {}),
      })
      .eq('id', existing.id)
    if (error) throw new Error(`upsertCareerPageSource update: ${error.message}`)
    return { id: existing.id, status: 'updated' }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('job_sources')
    .insert({
      name: `${args.company_name} werkenbij`,
      kind: 'company_career_page',
      company_id: args.company_id,
      url: canonical,
      discovery_method: args.discovery_method,
      is_external_ats: tier.is_external_ats,
      ats_type: tier.ats_type,
      created_via: 'sales_lead_run',
      source_run_id: args.run_id,
      active: true,
      scrape_frequency: 'weekly',
      review_status: tier.review_status,
      approved_at: tier.review_status === 'approved' ? now : null,
      // approved_by NULL bij auto-approval (geen user) — kunnen we later filteren als "system"
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single()
  if (insErr || !inserted) {
    // Race-condition: 2 parallelle runs raceden voorbij onze SELECT-check op
    // dezelfde (company_id, url). Unique partial index gooit 23505 — re-select
    // de winnende rij en treat als 'updated' zodat de loop niet breekt.
    if (insErr?.code === '23505') {
      const { data: raced } = await supabase
        .from('job_sources')
        .select('id')
        .eq('company_id', args.company_id)
        .eq('url', canonical)
        .eq('kind', 'company_career_page')
        .maybeSingle()
      if (raced) return { id: raced.id, status: 'updated' }
    }
    throw new Error(`upsertCareerPageSource insert: ${insErr?.message}`)
  }
  return { id: inserted.id, status: 'inserted' }
}

/**
 * V1A.1 confidence-tier:
 * - ATS-URL match (recruitee/greenhouse/lever/workable/teamtailor/personio) → auto-approved + ats_type
 * - method='html_link' (Mistral heeft echte link op homepage gezien) → auto-approved
 * - method='sitemap' of 'subdomain_probe' → pending review
 * - method='manual' → caller-bepaald (gebeurt elders, niet hier)
 */
function determineCareerPageTier(
  url: string,
  method: CareerPageMethod,
): { review_status: 'pending' | 'approved'; ats_type: string | null; is_external_ats: boolean } {
  const ats = detectAts(url)
  if (ats) {
    return { review_status: 'approved', ats_type: ats.type, is_external_ats: true }
  }
  if (method === 'html_link') {
    return { review_status: 'approved', ats_type: null, is_external_ats: false }
  }
  return { review_status: 'pending', ats_type: null, is_external_ats: false }
}

/**
 * Insert vacatures als job_postings; dedupe op (company_id, url).
 * Slaat vacancies zonder url over (kunnen niet uniek geïdentificeerd worden).
 */
export async function upsertJobPostingsFromRun(
  supabase: SB,
  args: {
    company_id: string
    source_id: string | null
    vacancies: NormalizedVacancy[]
  },
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  for (const v of args.vacancies) {
    if (!v.url) {
      skipped++
      continue
    }
    const { data: existing } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', args.company_id)
      .eq('url', v.url)
      .maybeSingle()
    if (existing) {
      skipped++
      continue
    }
    const now = new Date().toISOString()
    // Detail al bekend uit de inline website-stap? Dan velden meeschrijven en
    // de cron-worker niet meer laten ophalen. Geen detail (overflow boven de
    // inline-cap, tijd-budget op, of fetch geblokkeerd) -> needs_detail_scrape
    // op true zodat de career-page-detail cron hem alsnog verrijkt.
    const detailUpdate = v.detail ? detailFieldsToJobPostingUpdate(v.detail) : {}
    const { error } = await supabase.from('job_postings').insert({
      company_id: args.company_id,
      source_id: args.source_id,
      title: v.title,
      url: v.url,
      location: v.location ?? null,
      created_at: now,
      // scraped_at = nu (moment van scrapen). Voorheen null, wat de UI als
      // 1 januari 1970 rendert.
      scraped_at: now,
      ...detailUpdate,
      needs_detail_scrape: !v.detail,
    })
    if (error) {
      console.error(`[internal-linking] insert vacancy failed: ${error.message}`)
      skipped++
      continue
    }
    inserted++
  }
  return { inserted, skipped }
}

/**
 * Zoek de career-page-bron (job_sources kind='company_career_page') van een
 * bedrijf om vacatures aan te koppelen. Voorkeur voor een approved bron
 * ('approved' < 'pending' alfabetisch); 'rejected' wordt uitgesloten.
 * Returnt null als er geen bestaat.
 */
export async function resolveCareerPageSourceId(
  supabase: SB,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('job_sources')
    .select('id, review_status')
    .eq('company_id', companyId)
    .eq('kind', 'company_career_page')
    .neq('review_status', 'rejected')
    .order('review_status', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[internal-linking] resolveCareerPageSourceId:', error.message)
    return null
  }
  return data?.id ?? null
}

export function getServiceClient(): SB {
  return createServiceRoleClient() as unknown as SB
}
