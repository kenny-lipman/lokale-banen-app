import { createPublicClient } from './supabase'
import { slugifyCity } from '@lokale-banen/database'

export interface JobPosting {
  id: string
  title: string
  slug: string | null
  company_id: string | null
  city: string | null
  state: string | null
  zipcode: string | null
  street: string | null
  latitude: string | null
  longitude: string | null
  employment: string | null
  job_type: string[] | null
  salary: string | null
  description: string | null
  content_md: string | null
  header_image_url: string | null
  url: string | null
  published_at: string | null
  end_date: string | null
  created_at: string
  seo_title: string | null
  seo_description: string | null
  education_level: string | null
  career_level: string | null
  categories: string | null
  working_hours_min: number | null
  working_hours_max: number | null
  company: {
    id: string
    name: string
    slug: string | null
    logo_url: string | null
    website: string | null
    linkedin_url: string | null
    description: string | null
    city: string | null
    kvk: string | null
    latitude: number | null
    longitude: number | null
    postal_code: string | null
    street_address: string | null
  } | null
}

export type SortOption = 'newest' | 'salary_desc' | 'oldest' | 'nearest'

export interface JobFilter {
  query?: string
  location?: string
  type?: string
  hours?: string          // 'lt32' | '32-40' | 'gt40'
  education?: string[]    // education_level values
  sector?: string[]       // categories values
  page?: number
  sort?: SortOption
  /** User's geolocation for distance chip — from URL ?lat=X&lng=Y. */
  userLat?: number
  userLng?: number
}

/** Escape ILIKE wildcard characters in user input. */
function escapeIlike(s: string): string {
  return s.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

const JOBS_PER_PAGE = 20

const VALID_TYPES = ['vast', 'tijdelijk', 'fulltime', 'parttime', 'stage', 'bijbaan', 'freelance', 'vrijwilliger'] as const

/**
 * Fetch approved, published jobs for a tenant with optional filters.
 */
export async function getApprovedJobs(
  tenantId: string,
  filter: JobFilter = {}
): Promise<{ jobs: JobPosting[]; total: number }> {

  const supabase = createPublicClient()
  const page = filter.page || 1
  const from = (page - 1) * JOBS_PER_PAGE
  const to = from + JOBS_PER_PAGE - 1

  let query = supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state,
      latitude, longitude,
      employment, job_type, salary,
      description, url, published_at, end_date, created_at,
      education_level, working_hours_min, working_hours_max, categories,
      companies!company_id (
        id, name, slug, logo_url, website, linkedin_url, description, city,
        latitude, longitude
      )
    `,
      { count: 'exact' }
    )
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  // Apply sort order
  const sort = filter.sort || 'newest'
  if (sort === 'salary_desc') {
    query = query.order('salary', { ascending: false, nullsFirst: false })
  } else if (sort === 'oldest') {
    query = query.order('published_at', { ascending: true })
  } else {
    query = query.order('published_at', { ascending: false })
  }

  query = query.range(from, to)

  // Filter by employment type (strict validation to prevent injection)
  if (filter.type && filter.type !== 'alle') {
    const normalizedType = filter.type.toLowerCase() as typeof VALID_TYPES[number]
    if (VALID_TYPES.includes(normalizedType)) {
      const typeLabel = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)
      query = query.or(`employment.ilike.%${normalizedType}%,job_type.cs.{"${typeLabel}"}`)
    }
  }

  // Text search on title (escape ILIKE wildcards)
  if (filter.query) {
    const q = escapeIlike(filter.query)
    query = query.ilike('title', `%${q}%`)
  }

  // Location search on city (escape ILIKE wildcards)
  if (filter.location) {
    const loc = escapeIlike(filter.location)
    query = query.ilike('city', `%${loc}%`)
  }

  // Working hours filter
  if (filter.hours) {
    if (filter.hours === 'lt32') {
      query = query.lt('working_hours_max', 32)
    } else if (filter.hours === '32-40') {
      query = query.gte('working_hours_min', 32).lte('working_hours_max', 40)
    } else if (filter.hours === 'gt40') {
      query = query.gt('working_hours_min', 40)
    }
  }

  // Education level filter
  if (filter.education && filter.education.length > 0) {
    query = query.in('education_level', filter.education)
  }

  // Sector/categories filter
  if (filter.sector && filter.sector.length > 0) {
    query = query.in('categories', filter.sector)
  }

  const { data, count, error } = await query

  if (error) {
    console.error('Error fetching jobs:', error)
    return { jobs: [], total: 0 }
  }

  const jobs = (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    company: Array.isArray(row.companies) ? row.companies[0] : row.companies,
  })) as unknown as JobPosting[]

  return { jobs, total: count || 0 }
}

/**
 * Get freshness stats: most recent job + count of new jobs today.
 */
export async function getFreshnessStats(tenantId: string): Promise<{
  lastUpdatedAt: string | null
  newToday: number
}> {
  const supabase = createPublicClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [latestResult, newTodayResult] = await Promise.all([
    supabase
      .from('job_postings')
      .select('published_at')
      .eq('platform_id', tenantId)
      .eq('review_status', 'approved')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('job_postings')
      .select('id', { count: 'exact', head: true })
      .eq('platform_id', tenantId)
      .eq('review_status', 'approved')
      .gte('published_at', todayStart.toISOString()),
  ])

  return {
    lastUpdatedAt: latestResult.data?.published_at ?? null,
    newToday: newTodayResult.count ?? 0,
  }
}

/**
 * Count approved+published jobs for a tenant with the same filters as getApprovedJobs.
 */
export async function getJobCount(
  tenantId: string,
  filter: JobFilter = {}
): Promise<number> {

  const supabase = createPublicClient()

  let query = supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  if (filter.type && filter.type !== 'alle') {
    const normalizedType = filter.type.toLowerCase() as typeof VALID_TYPES[number]
    if (VALID_TYPES.includes(normalizedType)) {
      const typeLabel = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)
      query = query.or(`employment.ilike.%${normalizedType}%,job_type.cs.{"${typeLabel}"}`)
    }
  }

  if (filter.query) {
    const q = escapeIlike(filter.query)
    query = query.ilike('title', `%${q}%`)
  }

  if (filter.location) {
    const loc = escapeIlike(filter.location)
    query = query.ilike('city', `%${loc}%`)
  }

  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

/**
 * Filter facet counts for the sidebar — one DB round-trip via RPC.
 */
export interface FilterFacets {
  employment: { value: string; count: number }[]
  education: { value: string; count: number }[]
  sector: { value: string; count: number }[]
  hours: { value: string; count: number }[]
}

export async function getFilterFacets(tenantId: string): Promise<FilterFacets> {

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_job_filter_facets', {
    p_platform_id: tenantId,
  })

  if (error || !data) {
    console.error('Error fetching filter facets:', error)
    return { employment: [], education: [], sector: [], hours: [] }
  }

  const facets: FilterFacets = { employment: [], education: [], sector: [], hours: [] }
  for (const row of data as { facet_group: string; facet_value: string; facet_count: number }[]) {
    if (!row.facet_value) continue
    const entry = { value: row.facet_value, count: row.facet_count }
    switch (row.facet_group) {
      case 'employment':
        facets.employment.push(entry)
        break
      case 'education_level':
        facets.education.push(entry)
        break
      case 'categories':
        facets.sector.push(entry)
        break
      case 'hours':
        facets.hours.push(entry)
        break
    }
  }

  // Sort by count descending
  facets.employment.sort((a, b) => b.count - a.count)
  facets.education.sort((a, b) => b.count - a.count)
  facets.sector.sort((a, b) => b.count - a.count)
  facets.hours.sort((a, b) => b.count - a.count)

  return facets
}

/**
 * Fetch a single job posting by slug.
 */
export async function getJobBySlug(
  tenantId: string,
  slug: string
): Promise<JobPosting | null> {

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state, zipcode, street,
      latitude, longitude,
      employment, job_type, salary, categories,
      description, content_md, header_image_url, url, published_at, end_date, created_at,
      seo_title, seo_description, education_level, career_level,
      working_hours_min, working_hours_max,
      companies!company_id (
        id, name, slug, logo_url, website, linkedin_url, description, city,
        kvk, latitude, longitude, postal_code, street_address
      )
    `
    )
    .eq('slug', slug)
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  return {
    ...row,
    company: Array.isArray(row.companies) ? row.companies[0] : row.companies,
  } as unknown as JobPosting
}

/**
 * Fetch related jobs in the same city, excluding the current job.
 * Returns up to 3 results for the "Vergelijkbare banen" section.
 */
export async function getRelatedJobs(
  tenantId: string,
  city: string | null,
  excludeId: string
): Promise<JobPosting[]> {

  if (!city) return []

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state,
      employment, job_type, salary,
      published_at, end_date, created_at,
      companies!company_id (
        id, name, slug, logo_url, website, linkedin_url, description, city
      )
    `
    )
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .ilike('city', city)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(3)

  if (error || !data) return []

  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    company: Array.isArray(row.companies) ? row.companies[0] : row.companies,
  })) as unknown as JobPosting[]
}

/** Lightweight type for sitemap entries */
export interface SitemapJob {
  slug: string
  published_at: string
}

/**
 * Fetch all approved job slugs + dates for sitemap generation.
 * Limited to 50,000 (Google sitemap limit).
 */
export async function getSitemapJobs(
  tenantId: string
): Promise<SitemapJob[]> {

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select('slug, published_at')
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50000)

  if (error || !data) return []
  return data as SitemapJob[]
}

/** Lightweight type for llms.txt entries */
export interface LlmsJob {
  title: string
  slug: string
  city: string | null
  salary: string | null
  employment: string | null
  company_name: string | null
}

/**
 * Fetch approved jobs with company name for llms.txt manifest.
 * Returns up to `limit` jobs ordered by recency.
 */
export async function getLlmsJobs(
  tenantId: string,
  limit: number = 200
): Promise<LlmsJob[]> {

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      title, slug, city, salary, employment,
      companies!company_id ( name )
    `
    )
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('slug', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => {
    const company = Array.isArray(row.companies)
      ? row.companies[0]
      : row.companies
    return {
      title: row.title as string,
      slug: row.slug as string,
      city: row.city as string | null,
      salary: row.salary as string | null,
      employment: row.employment as string | null,
      company_name: (company as { name: string } | null)?.name ?? null,
    }
  })
}

/**
 * Count total approved+published jobs for a tenant.
 */
export async function getApprovedJobCount(tenantId: string): Promise<number> {

  const supabase = createPublicClient()

  const { count, error } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  if (error) return 0
  return count ?? 0
}

// ---------------------------------------------------------------------------
// City landing page queries
// ---------------------------------------------------------------------------

export interface CityWithCount {
  city: string
  slug: string
  count: number
}

/**
 * Fetch all distinct cities with job counts for a tenant.
 * Slugifies each city name and merges spelling variants under the same slug.
 * Returns sorted by count descending.
 */
export async function getCitiesWithJobCounts(
  tenantId: string
): Promise<CityWithCount[]> {

  const supabase = createPublicClient()

  // Use DB-side aggregation (GROUP BY) — returns ~100 rows instead of ~50k
  const { data, error } = await supabase.rpc('get_city_job_counts', {
    p_platform_id: tenantId,
  })

  if (error || !data || data.length === 0) return []

  // Group by slug, merge spelling variants (e.g. "naaldwijk" vs "Naaldwijk")
  const slugMap = new Map<string, { names: Map<string, number>; count: number }>()

  for (const row of data as { city: string; count: number }[]) {
    const slug = slugifyCity(row.city)
    if (!slug) continue

    const entry = slugMap.get(slug) || { names: new Map(), count: 0 }
    entry.count += row.count
    entry.names.set(row.city, (entry.names.get(row.city) || 0) + row.count)
    slugMap.set(slug, entry)
  }

  return Array.from(slugMap.entries())
    .map(([slug, { names, count }]) => {
      // Pick the most common spelling as display name
      let bestName = ''
      let bestCount = 0
      for (const [name, nameCount] of names) {
        if (nameCount > bestCount) {
          bestName = name
          bestCount = nameCount
        }
      }
      return { city: bestName, slug, count }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * Resolve a city slug to the original city name(s) and fetch paginated jobs.
 */
export async function getJobsByCitySlug(
  tenantId: string,
  citySlug: string,
  page = 1
): Promise<{ jobs: JobPosting[]; total: number; cityName: string | null }> {

  // First resolve the slug to actual city name(s)
  const allCities = await getCitiesWithJobCounts(tenantId)
  const match = allCities.find(c => c.slug === citySlug)

  if (!match) {
    return { jobs: [], total: 0, cityName: null }
  }

  // Use the display city name directly — getCitiesWithJobCounts already merged variants.
  // For the .in() filter, use ILIKE on the canonical display name (covers case variants).
  const supabase = createPublicClient()
  const from = (page - 1) * JOBS_PER_PAGE
  const to = from + JOBS_PER_PAGE - 1

  const { data, count, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state,
      employment, job_type, salary,
      description, url, published_at, end_date, created_at,
      companies!company_id (
        id, name, slug, logo_url, website, linkedin_url, description, city
      )
    `,
      { count: 'exact' }
    )
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .ilike('city', match.city)
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error || !data) {
    return { jobs: [], total: 0, cityName: match.city }
  }

  const jobs = (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    company: Array.isArray(row.companies) ? row.companies[0] : row.companies,
  })) as unknown as JobPosting[]

  return { jobs, total: count || 0, cityName: match.city }
}

/**
 * Fetch nearby cities (other cities for this tenant, excluding the given one).
 */
export async function getNearbyCities(
  tenantId: string,
  excludeSlug: string,
  limit = 8
): Promise<CityWithCount[]> {

  const allCities = await getCitiesWithJobCounts(tenantId)
  return allCities
    .filter(c => c.slug !== excludeSlug)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Company page queries
// ---------------------------------------------------------------------------

export interface CompanyProfile {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  website: string | null
  linkedin_url: string | null
  city: string | null
  kvk: string | null
  latitude: number | null
  longitude: number | null
  postal_code: string | null
  street_address: string | null
}

/**
 * Fetch a company by slug, only if it has approved jobs on this tenant.
 */
export async function getCompanyBySlug(
  tenantId: string,
  companySlug: string
): Promise<CompanyProfile | null> {

  const supabase = createPublicClient()

  // Find company by slug
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, name, slug, description, logo_url, website, linkedin_url, city, kvk, latitude, longitude, postal_code, street_address')
    .eq('slug', companySlug)
    .single()

  if (error || !company) return null

  // Verify it has at least one approved job on this tenant
  const { count } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .eq('platform_id', tenantId)
    .eq('company_id', company.id)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  if (!count || count === 0) return null

  return company as CompanyProfile
}

/**
 * Fetch paginated jobs for a company on a specific tenant.
 */
export async function getJobsByCompany(
  tenantId: string,
  companyId: string,
  page = 1
): Promise<{ jobs: JobPosting[]; total: number }> {

  const supabase = createPublicClient()
  const from = (page - 1) * JOBS_PER_PAGE
  const to = from + JOBS_PER_PAGE - 1

  const { data, count, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state,
      employment, job_type, salary,
      description, url, published_at, end_date, created_at,
      companies!company_id (
        id, name, slug, logo_url, website, linkedin_url, description, city
      )
    `,
      { count: 'exact' }
    )
    .eq('platform_id', tenantId)
    .eq('company_id', companyId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error || !data) return { jobs: [], total: 0 }

  const jobs = (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    company: Array.isArray(row.companies) ? row.companies[0] : row.companies,
  })) as unknown as JobPosting[]

  return { jobs, total: count || 0 }
}

/**
 * Fetch the top cities by approved job count for a tenant.
 * Fetches only the city column (no row limit) and counts in-memory.
 */
export async function getTopCities(
  tenantId: string,
  limit = 5
): Promise<{ city: string; count: number }[]> {

  const supabase = createPublicClient()

  // Fetch all approved cities for this tenant (only city column, lightweight)
  const { data } = await supabase
    .from('job_postings')
    .select('city')
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('city', 'is', null)

  if (!data || data.length === 0) return []

  // Count occurrences
  const counts = new Map<string, number>()
  for (const row of data) {
    if (row.city) {
      counts.set(row.city, (counts.get(row.city) || 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Helpers for JSON-LD schema
// ---------------------------------------------------------------------------

/**
 * Parse salary text like "2800 - 3500" into min/max numbers.
 * Returns null if the string can't be parsed.
 */
export function parseSalary(
  salary: string | null
): { min: number; max: number; unit: string } | null {
  if (!salary || salary.trim() === '-' || salary.trim() === '') return null
  // Match patterns like "2800 - 3500", "2.800 - 3.500", "€2800-3500"
  const cleaned = salary.replace(/[€\s.]/g, '')
  const match = cleaned.match(/(\d+)\s*-\s*(\d+)/)
  if (!match) return null
  const min = parseInt(match[1], 10)
  const max = parseInt(match[2], 10)
  if (isNaN(min) || isNaN(max) || min <= 0) return null
  return { min, max, unit: 'MONTH' }
}

/**
 * Map Dutch employment type strings to schema.org employmentType values.
 */
const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  vast: 'FULL_TIME',
  fulltime: 'FULL_TIME',
  voltijd: 'FULL_TIME',
  tijdelijk: 'TEMPORARY',
  parttime: 'PART_TIME',
  deeltijd: 'PART_TIME',
  stage: 'INTERN',
  intern: 'INTERN',
  vrijwilliger: 'VOLUNTEER',
  bijbaan: 'PART_TIME',
  freelance: 'CONTRACTOR',
  zzp: 'CONTRACTOR',
}

export function mapEmploymentType(type: string | null): string | undefined {
  if (!type) return undefined
  const lower = type.toLowerCase().trim()
  // Direct match
  if (EMPLOYMENT_TYPE_MAP[lower]) return EMPLOYMENT_TYPE_MAP[lower]
  // Partial match
  for (const [key, value] of Object.entries(EMPLOYMENT_TYPE_MAP)) {
    if (lower.includes(key)) return value
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Master aggregator queries (lokalebanen.nl — tier='master')
// ---------------------------------------------------------------------------

/** Job row returned by master aggregator queries — includes primary platform info. */
export interface MasterJobPosting extends JobPosting {
  primary_platform: {
    id: string
    name: string
    domain: string | null
    preview_domain: string | null
  } | null
}

/** Summary row for a platform in the master aggregator grid. */
export interface PlatformSummary {
  id: string
  name: string
  domain: string | null
  preview_domain: string | null
  central_place: string | null
  job_count: number
}

interface MasterJobsOptions {
  limit?: number
  offset?: number
  city?: string
  /** Filter to a single primary platform id. */
  platformId?: string
}

/**
 * Master: fetch approved+published jobs across all regio platforms.
 * Joins via `job_posting_platforms` where `is_primary=true` to surface the
 * canonical owner platform alongside each job (for badges + canonical URL).
 */
export async function getJobsAcrossAllPlatforms(
  options: MasterJobsOptions = {}
): Promise<{ jobs: MasterJobPosting[]; total: number }> {

  const limit = options.limit ?? 20
  const offset = options.offset ?? 0
  const from = offset
  const to = offset + limit - 1

  const supabase = createPublicClient()

  // Base query: jobs via is_primary junction, filtered on approved+published.
  let query = supabase
    .from('job_posting_platforms')
    .select(
      `
      is_primary,
      platforms:platform_id (
        id, regio_platform, domain, preview_domain, central_place, tier, is_public
      ),
      job_postings!inner (
        id, title, slug, company_id, city, state,
        employment, job_type, salary,
        description, url, published_at, end_date, created_at,
        review_status,
        companies!company_id (
          id, name, slug, logo_url, website, linkedin_url, description, city
        )
      )
    `,
      { count: 'exact' }
    )
    .eq('is_primary', true)
    .eq('job_postings.review_status', 'approved')
    .not('job_postings.published_at', 'is', null)

  if (options.platformId) {
    query = query.eq('platform_id', options.platformId)
  }

  if (options.city) {
    query = query.ilike('job_postings.city', `%${options.city}%`)
  }

  query = query
    .order('published_at', {
      ascending: false,
      referencedTable: 'job_postings',
      nullsFirst: false,
    })
    .range(from, to)

  const { data, count, error } = await query

  if (error || !data) {
    if (error) console.error('[master] getJobsAcrossAllPlatforms error:', error)
    return { jobs: [], total: 0 }
  }

  const jobs: MasterJobPosting[] = []
  for (const row of data as Record<string, unknown>[]) {
    const jp = Array.isArray(row.job_postings)
      ? (row.job_postings[0] as Record<string, unknown> | undefined)
      : (row.job_postings as Record<string, unknown> | undefined)
    if (!jp) continue

    // Skip jobs from non-public platforms (shouldn't happen given seed, but defensive).
    const plat = Array.isArray(row.platforms)
      ? (row.platforms[0] as Record<string, unknown> | undefined)
      : (row.platforms as Record<string, unknown> | undefined)
    if (!plat || plat.is_public === false) continue

    const company = Array.isArray(jp.companies) ? jp.companies[0] : jp.companies

    jobs.push({
      ...(jp as unknown as JobPosting),
      company: (company ?? null) as JobPosting['company'],
      primary_platform: {
        id: plat.id as string,
        name: plat.regio_platform as string,
        domain: (plat.domain as string | null) ?? null,
        preview_domain: (plat.preview_domain as string | null) ?? null,
      },
    } as MasterJobPosting)
  }

  return { jobs, total: count || jobs.length }
}

/**
 * Master: list all public regio platforms (tier='free') with their approved
 * primary job count, sorted by count desc. Used for the master homepage grid.
 */
export async function getTopPlatforms(): Promise<PlatformSummary[]> {

  const supabase = createPublicClient()

  const { data: platforms, error } = await supabase
    .from('platforms')
    .select('id, regio_platform, domain, preview_domain, central_place, tier')
    .eq('is_public', true)
    .eq('tier', 'free')
    .order('regio_platform', { ascending: true })

  if (error || !platforms || platforms.length === 0) {
    if (error) console.error('[master] getTopPlatforms error:', error)
    return []
  }

  // Count approved primary jobs per platform in parallel.
  const counts = await Promise.all(
    platforms.map(async (p) => {
      const { count } = await supabase
        .from('job_posting_platforms')
        .select('job_posting_id, job_postings!inner(review_status, published_at)', {
          count: 'exact',
          head: true,
        })
        .eq('platform_id', p.id)
        .eq('is_primary', true)
        .eq('job_postings.review_status', 'approved')
        .not('job_postings.published_at', 'is', null)
      return { id: p.id, count: count ?? 0 }
    })
  )
  const countById = new Map(counts.map((c) => [c.id, c.count]))

  return (platforms as Record<string, unknown>[])
    .map((p) => ({
      id: p.id as string,
      name: p.regio_platform as string,
      domain: (p.domain as string | null) ?? null,
      preview_domain: (p.preview_domain as string | null) ?? null,
      central_place: (p.central_place as string | null) ?? null,
      job_count: countById.get(p.id as string) ?? 0,
    }))
    .sort((a, b) => b.job_count - a.job_count || a.name.localeCompare(b.name))
}

/**
 * Master: aggregate top cities across all public regio platforms.
 * Counts approved+published jobs grouped by lower(city).
 */
export async function getTopCitiesAcrossPlatforms(
  limit = 20
): Promise<{ city: string; count: number }[]> {

  const supabase = createPublicClient()

  // Pull only the city column from approved primary junction rows. Lightweight.
  const { data, error } = await supabase
    .from('job_posting_platforms')
    .select(
      `
      job_postings!inner (
        city, review_status, published_at
      )
    `
    )
    .eq('is_primary', true)
    .eq('job_postings.review_status', 'approved')
    .not('job_postings.published_at', 'is', null)
    .not('job_postings.city', 'is', null)
    .limit(50000)

  if (error || !data) {
    if (error) console.error('[master] getTopCitiesAcrossPlatforms error:', error)
    return []
  }

  const counts = new Map<string, { display: string; count: number }>()
  for (const row of data as Record<string, unknown>[]) {
    const jp = Array.isArray(row.job_postings) ? row.job_postings[0] : row.job_postings
    const city = (jp as { city?: string } | null | undefined)?.city
    if (!city) continue
    const key = city.toLowerCase()
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { display: city, count: 1 })
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ display, count }) => ({ city: display, count }))
}

/**
 * Master: total approved+published jobs across all public regio platforms.
 */
export async function getMasterJobCount(): Promise<number> {

  const supabase = createPublicClient()
  const { count, error } = await supabase
    .from('job_posting_platforms')
    .select('job_posting_id, job_postings!inner(review_status, published_at)', {
      count: 'exact',
      head: true,
    })
    .eq('is_primary', true)
    .eq('job_postings.review_status', 'approved')
    .not('job_postings.published_at', 'is', null)

  if (error) return 0
  return count ?? 0
}

/**
 * Master: fetch a single approved job by slug across all platforms.
 * Returns the job with its primary platform info (for canonical + badge).
 */
export async function getMasterJobBySlug(
  slug: string
): Promise<MasterJobPosting | null> {

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state, zipcode, street,
      latitude, longitude,
      employment, job_type, salary, categories,
      description, content_md, header_image_url, url, published_at, end_date, created_at,
      seo_title, seo_description, education_level, career_level,
      working_hours_min, working_hours_max,
      companies!company_id (
        id, name, slug, logo_url, website, linkedin_url, description, city,
        kvk, latitude, longitude, postal_code, street_address
      ),
      job_posting_platforms!inner (
        is_primary,
        platforms:platform_id (
          id, regio_platform, domain, preview_domain, is_public
        )
      )
    `
    )
    .eq('slug', slug)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .eq('job_posting_platforms.is_primary', true)
    .maybeSingle()

  if (error || !data) return null

  const row = data as Record<string, unknown>
  const junction = Array.isArray(row.job_posting_platforms)
    ? (row.job_posting_platforms[0] as Record<string, unknown> | undefined)
    : (row.job_posting_platforms as Record<string, unknown> | undefined)
  const plat = junction
    ? Array.isArray(junction.platforms)
      ? (junction.platforms[0] as Record<string, unknown> | undefined)
      : (junction.platforms as Record<string, unknown> | undefined)
    : undefined

  return {
    ...(row as unknown as JobPosting),
    company: Array.isArray(row.companies)
      ? (row.companies[0] as JobPosting['company'])
      : (row.companies as JobPosting['company']),
    primary_platform: plat
      ? {
          id: plat.id as string,
          name: plat.regio_platform as string,
          domain: (plat.domain as string | null) ?? null,
          preview_domain: (plat.preview_domain as string | null) ?? null,
        }
      : null,
  } as MasterJobPosting
}
