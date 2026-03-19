/**
 * Lokale Banen Push Service
 * Orchestrates pushing job postings to the Lokale Banen jobboard:
 * 1. Resolve mappings (domain, sector, employment, education)
 * 2. Create company if needed (with email from contacts)
 * 3. Generate AI content (function_description, function_demands, etc.)
 * 4. Create vacancy via LB API
 */

import { getLokaleBanenClient } from '@/lib/lokalebanen-client'
import { generateVacancyContent } from '@/lib/services/lokalebanen-content.service'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// TYPES
// ============================================================================

export interface PushProgressEvent {
  type: 'start' | 'company_resolving' | 'company_created' | 'company_exists' | 'ai_generating' | 'vacancy_created' | 'skipped' | 'error' | 'complete'
  jobPostingId?: string
  current: number
  total: number
  title?: string
  message: string
  error?: string
}

export interface PushResult {
  success: number
  skipped: number
  failed: number
  details: Array<{
    jobPostingId: string
    title: string
    status: 'created' | 'skipped' | 'failed'
    reason?: string
    lokaleBanenId?: string
  }>
}

interface JobPostingWithCompany {
  id: string
  title: string
  description: string | null
  city: string | null
  zipcode: string | null
  street: string | null
  employment: string | null
  education_level: string | null
  categories: string | null
  working_hours_min: number | null
  working_hours_max: number | null
  end_date: string | null
  created_at: string
  platform_id: string | null
  lokalebanen_id: string | null
  company_id: string
  companies: {
    id: string
    name: string
    city: string | null
    street_address: string | null
    postal_code: string | null
    phone: string | null
    description: string | null
    lokalebanen_id: string | null
  }
}

interface MappingRow {
  type: string
  our_value: string
  their_value: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse a street address into street name and number
 * "Kerkstraat 12a" → { street: "Kerkstraat", streetnr: "12a" }
 * "Kerkstraat" → { street: "Kerkstraat", streetnr: "1" }
 */
export function parseStreetAddress(address: string | null): { street: string; streetnr: string } {
  if (!address || address.trim() === '') {
    return { street: 'Onbekend', streetnr: '1' }
  }

  const trimmed = address.trim()
  const match = trimmed.match(/^(.+?)\s+(\d+.*)$/)

  if (match) {
    return { street: match[1].trim(), streetnr: match[2].trim() }
  }

  return { street: trimmed, streetnr: '1' }
}

/**
 * Format weekly hours for LB API
 */
function formatWeeklyHours(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${min}-${max} uur`
  if (min) return `${min} uur`
  if (max) return `${max} uur`
  return '40 uur'
}

/**
 * Get the primary category from a comma-separated categories string
 */
function getPrimaryCategory(categories: string | null): string | null {
  if (!categories) return null
  return categories.split(',')[0].trim()
}

/**
 * Get the primary employment type from a comma-separated string
 */
function getPrimaryEmployment(employment: string | null): string | null {
  if (!employment) return null
  // Some values are like "Tijdelijk, Vast" - take the first one
  return employment.split(',')[0].trim()
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: Array<{
    jobPostingId: string
    title: string
    companyName: string
    domain: string
    hasEmail: boolean
  }>
  invalid: Array<{
    jobPostingId: string
    title: string
    reason: string
  }>
}

export async function validateJobPostingsForPush(
  jobPostingIds: string[],
  supabase: SupabaseClient
): Promise<ValidationResult> {
  // Fetch job postings with company data
  const { data: jobPostings, error } = await supabase
    .from('job_postings')
    .select(`
      id, title, description, city, employment, education_level, categories,
      working_hours_min, working_hours_max, platform_id, lokalebanen_id,
      company_id,
      companies!inner (
        id, name, city, postal_code, street_address, lokalebanen_id
      )
    `)
    .in('id', jobPostingIds)

  if (error) throw new Error(`Failed to fetch job postings: ${error.message}`)
  if (!jobPostings || jobPostings.length === 0) {
    return { valid: [], invalid: [] }
  }

  // Fetch all mappings
  const { data: mappings } = await supabase
    .from('lokalebanen_mappings')
    .select('type, our_value, their_value')

  const mappingMap = new Map<string, string | null>()
  for (const m of (mappings || []) as MappingRow[]) {
    mappingMap.set(`${m.type}:${m.our_value}`, m.their_value)
  }

  // Fetch platform names for domain mapping
  const platformIds = [...new Set(jobPostings.map((jp: any) => jp.platform_id).filter(Boolean))]
  const { data: platforms } = await supabase
    .from('platforms')
    .select('id, regio_platform')
    .in('id', platformIds)

  const platformMap = new Map<string, string>()
  for (const p of (platforms || []) as any[]) {
    platformMap.set(p.id, p.regio_platform)
  }

  // Fetch emails for companies
  const companyIds = [...new Set(jobPostings.map((jp: any) => (jp.companies as any).id))]
  const { data: contacts } = await supabase
    .from('contacts')
    .select('company_id, email')
    .in('company_id', companyIds)
    .not('email', 'is', null)
    .limit(1000)

  const companyEmailMap = new Map<string, string>()
  for (const c of (contacts || []) as any[]) {
    if (c.email && !companyEmailMap.has(c.company_id)) {
      companyEmailMap.set(c.company_id, c.email)
    }
  }

  const valid: ValidationResult['valid'] = []
  const invalid: ValidationResult['invalid'] = []

  for (const jp of jobPostings as any[]) {
    const company = jp.companies as any

    // Already pushed
    if (jp.lokalebanen_id) {
      invalid.push({ jobPostingId: jp.id, title: jp.title, reason: 'Al gepusht naar Lokale Banen' })
      continue
    }

    // No platform assigned
    if (!jp.platform_id) {
      invalid.push({ jobPostingId: jp.id, title: jp.title, reason: 'Geen platform toegewezen' })
      continue
    }

    // Domain mapping
    const platformName = platformMap.get(jp.platform_id)
    if (!platformName) {
      invalid.push({ jobPostingId: jp.id, title: jp.title, reason: 'Platform niet gevonden' })
      continue
    }

    const domain = mappingMap.get(`domain:${platformName}`)
    if (!domain) {
      invalid.push({ jobPostingId: jp.id, title: jp.title, reason: `Domain mapping ontbreekt voor ${platformName}` })
      continue
    }

    // Company email
    const hasEmail = companyEmailMap.has(company.id) || !!company.lokalebanen_id
    if (!hasEmail && !company.lokalebanen_id) {
      invalid.push({ jobPostingId: jp.id, title: jp.title, reason: `Geen email voor bedrijf ${company.name}` })
      continue
    }

    // City required
    if (!jp.city && !company.city) {
      invalid.push({ jobPostingId: jp.id, title: jp.title, reason: 'Geen stad beschikbaar' })
      continue
    }

    valid.push({
      jobPostingId: jp.id,
      title: jp.title,
      companyName: company.name,
      domain,
      hasEmail,
    })
  }

  return { valid, invalid }
}

// ============================================================================
// PUSH
// ============================================================================

export async function pushJobPostingsToLB(
  jobPostingIds: string[],
  supabase: SupabaseClient,
  onProgress: (event: PushProgressEvent) => void
): Promise<PushResult> {
  const client = getLokaleBanenClient()
  const result: PushResult = { success: 0, skipped: 0, failed: 0, details: [] }
  const total = jobPostingIds.length

  onProgress({ type: 'start', current: 0, total, message: `Start push van ${total} vacatures...` })

  // Fetch all data upfront
  const { data: jobPostings, error } = await supabase
    .from('job_postings')
    .select(`
      id, title, description, city, zipcode, street, employment, education_level,
      categories, working_hours_min, working_hours_max, end_date, created_at,
      platform_id, lokalebanen_id, company_id,
      companies!inner (
        id, name, city, street_address, postal_code, phone, description, lokalebanen_id
      )
    `)
    .in('id', jobPostingIds)

  if (error || !jobPostings) {
    onProgress({ type: 'error', current: 0, total, message: `Database error: ${error?.message}` })
    return result
  }

  // Fetch mappings
  const { data: mappings } = await supabase
    .from('lokalebanen_mappings')
    .select('type, our_value, their_value')

  const mappingMap = new Map<string, string | null>()
  for (const m of (mappings || []) as MappingRow[]) {
    mappingMap.set(`${m.type}:${m.our_value}`, m.their_value)
  }

  // Fetch platform names
  const platformIds = [...new Set(jobPostings.map((jp: any) => jp.platform_id).filter(Boolean))]
  const { data: platforms } = await supabase
    .from('platforms')
    .select('id, regio_platform')
    .in('id', platformIds)

  const platformMap = new Map<string, string>()
  for (const p of (platforms || []) as any[]) {
    platformMap.set(p.id, p.regio_platform)
  }

  // Fetch emails for companies
  const companyIds = [...new Set(jobPostings.map((jp: any) => (jp.companies as any).id))]
  const { data: contacts } = await supabase
    .from('contacts')
    .select('company_id, email')
    .in('company_id', companyIds)
    .not('email', 'is', null)
    .limit(1000)

  const companyEmailMap = new Map<string, string>()
  for (const c of (contacts || []) as any[]) {
    if (c.email && !companyEmailMap.has(c.company_id)) {
      companyEmailMap.set(c.company_id, c.email)
    }
  }

  // ----------------------------------------------------------------
  // DEDUPLICATION: Fetch existing LB companies to match by name+city
  // ----------------------------------------------------------------
  onProgress({ type: 'start', current: 0, total, message: 'Bestaande bedrijven ophalen van Lokale Banen...' })

  let lbCompanyIndex = new Map<string, string>() // "name|city" → LB company ID
  try {
    const lbCompanies = await client.getCompanies()
    for (const lbc of lbCompanies) {
      const key = `${lbc.name.toLowerCase().trim()}|${lbc.city.toLowerCase().trim()}`
      lbCompanyIndex.set(key, String(lbc.id))
    }
    console.log(`📋 ${lbCompanies.length} bestaande LB bedrijven geladen voor deduplicatie`)
  } catch (err) {
    console.warn('⚠️ Kon LB bedrijven niet ophalen voor deduplicatie, ga door zonder:', err)
  }

  // In-memory cache: our company_id → LB company_id (for batch dedup)
  const companyLbIdCache = new Map<string, string>()

  // Process each job posting
  for (let i = 0; i < jobPostings.length; i++) {
    const jp = jobPostings[i] as unknown as JobPostingWithCompany
    const company = jp.companies
    const current = i + 1

    try {
      // Skip if already pushed
      if (jp.lokalebanen_id) {
        result.skipped++
        result.details.push({ jobPostingId: jp.id, title: jp.title, status: 'skipped', reason: 'Al gepusht' })
        onProgress({ type: 'skipped', jobPostingId: jp.id, current, total, title: jp.title, message: `Overgeslagen: al gepusht` })
        continue
      }

      // Resolve domain mapping
      const platformName = jp.platform_id ? platformMap.get(jp.platform_id) : null
      const domain = platformName ? mappingMap.get(`domain:${platformName}`) : null
      if (!domain) {
        result.skipped++
        result.details.push({ jobPostingId: jp.id, title: jp.title, status: 'skipped', reason: 'Geen domain mapping' })
        onProgress({ type: 'skipped', jobPostingId: jp.id, current, total, title: jp.title, message: `Overgeslagen: geen domain mapping` })
        continue
      }

      // Resolve sector mapping
      const primaryCategory = getPrimaryCategory(jp.categories)
      const sector = primaryCategory ? mappingMap.get(`sector:${primaryCategory}`) : null

      // Resolve employment mapping
      const primaryEmployment = getPrimaryEmployment(jp.employment)
      const employment = primaryEmployment ? mappingMap.get(`employment:${primaryEmployment}`) : null

      // Resolve education mapping
      const education = jp.education_level ? mappingMap.get(`education:${jp.education_level}`) : null

      // ----------------------------------------------------------------
      // Step 1: Resolve company (3-layer dedup)
      //   1. Check our DB (lokalebanen_id on companies table)
      //   2. Check in-memory batch cache (same company in this batch)
      //   3. Match against existing LB companies by name+city
      //   4. Only create if none of the above match
      // ----------------------------------------------------------------
      let lbCompanyId = company.lokalebanen_id

      // Layer 2: Check batch cache (same company already processed in this batch)
      if (!lbCompanyId && companyLbIdCache.has(company.id)) {
        lbCompanyId = companyLbIdCache.get(company.id)!
        onProgress({ type: 'company_exists', jobPostingId: jp.id, current, total, title: jp.title, message: `Bedrijf al verwerkt in batch: ${company.name}` })
      }

      // Layer 3: Match against existing LB companies by name+city
      if (!lbCompanyId) {
        const companyCity = company.city || jp.city || ''
        const matchKey = `${company.name.toLowerCase().trim()}|${companyCity.toLowerCase().trim()}`
        const existingLbId = lbCompanyIndex.get(matchKey)

        if (existingLbId) {
          lbCompanyId = existingLbId

          // Save to our DB so future pushes don't need to look up again
          await supabase
            .from('companies')
            .update({ lokalebanen_id: lbCompanyId, lokalebanen_pushed_at: new Date().toISOString() })
            .eq('id', company.id)

          companyLbIdCache.set(company.id, lbCompanyId)
          onProgress({ type: 'company_exists', jobPostingId: jp.id, current, total, title: jp.title, message: `Bedrijf gevonden bij LB: ${company.name}` })
        }
      }

      // Layer 4: Create new company
      if (!lbCompanyId) {
        onProgress({ type: 'company_resolving', jobPostingId: jp.id, current, total, title: jp.title, message: `Bedrijf aanmaken: ${company.name}` })

        const email = companyEmailMap.get(company.id)
        if (!email) {
          result.skipped++
          result.details.push({ jobPostingId: jp.id, title: jp.title, status: 'skipped', reason: `Geen email voor ${company.name}` })
          onProgress({ type: 'skipped', jobPostingId: jp.id, current, total, title: jp.title, message: `Overgeslagen: geen email voor bedrijf` })
          continue
        }

        const { street, streetnr } = parseStreetAddress(company.street_address)

        const companyResponse = await client.createCompany({
          domain,
          companyname: company.name,
          street,
          streetnr,
          postalcode: company.postal_code || '0000AA',
          city: company.city || jp.city || 'Onbekend',
          email,
          telephone: company.phone || undefined,
        })

        lbCompanyId = companyResponse.id

        // Save to DB + batch cache + LB index (prevent dupes in same batch AND future batches)
        await supabase
          .from('companies')
          .update({ lokalebanen_id: lbCompanyId, lokalebanen_pushed_at: new Date().toISOString() })
          .eq('id', company.id)

        companyLbIdCache.set(company.id, lbCompanyId)
        const companyCity = company.city || jp.city || ''
        lbCompanyIndex.set(`${company.name.toLowerCase().trim()}|${companyCity.toLowerCase().trim()}`, lbCompanyId)

        onProgress({ type: 'company_created', jobPostingId: jp.id, current, total, title: jp.title, message: `Bedrijf aangemaakt: ${company.name}` })
      } else if (company.lokalebanen_id) {
        onProgress({ type: 'company_exists', jobPostingId: jp.id, current, total, title: jp.title, message: `Bedrijf bestaat al: ${company.name}` })
      }

      // ----------------------------------------------------------------
      // Step 2: Generate AI content
      // ----------------------------------------------------------------
      onProgress({ type: 'ai_generating', jobPostingId: jp.id, current, total, title: jp.title, message: `AI content genereren...` })

      const content = await generateVacancyContent(
        jp.title,
        jp.description || '',
        company.name,
        company.description
      )

      // ----------------------------------------------------------------
      // Step 3: Create vacancy
      // ----------------------------------------------------------------
      const now = new Date()
      const endDate = jp.end_date
        ? new Date(jp.end_date)
        : new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // +60 days default

      const vacancyResponse = await client.createVacancy({
        domain,
        title: jp.title,
        city: jp.city || company.city || 'Onbekend',
        company_id: lbCompanyId,
        start_at: now.toISOString(),
        end_at: endDate.toISOString(),
        sector: sector || 'overig',
        employments: employment || 'fulltime',
        educations: education || 'overig',
        weeklyhours: formatWeeklyHours(jp.working_hours_min, jp.working_hours_max),
        function_description: content.function_description || undefined,
        function_demands: content.function_demands || undefined,
        company_profile: content.company_profile || undefined,
        interest_text: content.interest_text || undefined,
      })

      // Save LB vacancy ID
      await supabase
        .from('job_postings')
        .update({ lokalebanen_id: vacancyResponse.id, lokalebanen_pushed_at: new Date().toISOString() })
        .eq('id', jp.id)

      result.success++
      result.details.push({ jobPostingId: jp.id, title: jp.title, status: 'created', lokaleBanenId: vacancyResponse.id })
      onProgress({ type: 'vacancy_created', jobPostingId: jp.id, current, total, title: jp.title, message: `Vacature aangemaakt op Lokale Banen` })

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Onbekende fout'
      result.failed++
      result.details.push({ jobPostingId: jp.id, title: jp.title, status: 'failed', reason: errorMsg })
      onProgress({ type: 'error', jobPostingId: jp.id, current, total, title: jp.title, message: `Fout: ${errorMsg}`, error: errorMsg })
    }
  }

  onProgress({
    type: 'complete',
    current: total,
    total,
    message: `Klaar! ${result.success} aangemaakt, ${result.skipped} overgeslagen, ${result.failed} mislukt`,
  })

  return result
}
