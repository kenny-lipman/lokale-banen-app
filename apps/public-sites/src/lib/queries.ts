import { createPublicClient } from './supabase'

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

export type SortOption = 'newest' | 'salary_desc' | 'oldest'

export interface JobFilter {
  query?: string
  location?: string
  type?: string
  page?: number
  sort?: SortOption
}

const JOBS_PER_PAGE = 20

/**
 * Fetch approved, published jobs for a tenant with optional filters.
 */
export async function getApprovedJobs(
  tenantId: string,
  filter: JobFilter = {}
): Promise<{ jobs: JobPosting[]; total: number }> {
  // TODO: add 'use cache' + cacheLife after build verification

  const supabase = createPublicClient()
  const page = filter.page || 1
  const from = (page - 1) * JOBS_PER_PAGE
  const to = from + JOBS_PER_PAGE - 1

  let query = supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state,
      employment, job_type, salary,
      description, url, published_at, end_date, created_at,
      companies!company_id (
        id, name, logo_url, website, linkedin_url, description, city
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

  // Filter by employment type (match against job_type array or employment field)
  if (filter.type && filter.type !== 'alle') {
    const typeLabel = filter.type.charAt(0).toUpperCase() + filter.type.slice(1)
    query = query.or(`employment.ilike.%${filter.type}%,job_type.cs.{"${typeLabel}"}`)
  }

  // Text search on title
  if (filter.query) {
    query = query.ilike('title', `%${filter.query}%`)
  }

  // Location search on city
  if (filter.location) {
    query = query.ilike('city', `%${filter.location}%`)
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
    const typeLabel = filter.type.charAt(0).toUpperCase() + filter.type.slice(1)
    query = query.or(`employment.ilike.%${filter.type}%,job_type.cs.{"${typeLabel}"}`)
  }

  if (filter.query) {
    query = query.ilike('title', `%${filter.query}%`)
  }

  if (filter.location) {
    query = query.ilike('city', `%${filter.location}%`)
  }

  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

/**
 * Fetch a single job posting by slug.
 */
export async function getJobBySlug(
  tenantId: string,
  slug: string
): Promise<JobPosting | null> {
  // TODO: add 'use cache' + cacheLife after build verification

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_id, city, state, zipcode, street,
      latitude, longitude,
      employment, job_type, salary, categories,
      description, content_md, url, published_at, end_date, created_at,
      seo_title, seo_description, education_level, career_level,
      working_hours_min, working_hours_max,
      companies!company_id (
        id, name, logo_url, website, linkedin_url, description, city,
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
  // TODO: add 'use cache' + cacheLife after build verification

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
        id, name, logo_url, website, linkedin_url, description, city
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

/**
 * Fetch the top 5 cities by approved job count for a tenant.
 */
export async function getTopCities(
  tenantId: string
): Promise<{ city: string; count: number }[]> {
  const supabase = createPublicClient()

  // Query a sample of jobs and count cities client-side
  const { data } = await supabase
    .from('job_postings')
    .select('city')
    .eq('platform_id', tenantId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .not('city', 'is', null)
    .limit(1000)

  if (!data) return []

  const counts: Record<string, number> = {}
  for (const row of data) {
    const city = (row.city as string)?.trim()
    if (city) {
      counts[city] = (counts[city] || 0) + 1
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([city, count]) => ({ city, count }))
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
