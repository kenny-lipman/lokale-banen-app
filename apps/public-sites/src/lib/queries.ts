import { cacheLife, cacheTag } from 'next/cache'
import { createPublicClient } from './supabase'

export interface JobPosting {
  id: string
  title: string
  slug: string | null
  company_name: string | null
  company_id: string | null
  city: string | null
  state: string | null
  employment_type: string | null
  salary: string | null
  salary_min: number | null
  salary_max: number | null
  description: string | null
  url: string | null
  published_at: string | null
  end_date: string | null
  created_at: string
  source: string | null
  company: {
    id: string
    name: string
    logo_url: string | null
    website: string | null
    linkedin_url: string | null
    description: string | null
  } | null
}

export interface JobFilter {
  query?: string
  location?: string
  type?: string
  page?: number
}

const JOBS_PER_PAGE = 20

/**
 * Fetch approved, published jobs for a tenant with optional filters.
 * Results are cached for 5 minutes, tagged per tenant for targeted invalidation.
 */
export async function getApprovedJobs(
  tenantId: string,
  filter: JobFilter = {}
): Promise<{ jobs: JobPosting[]; total: number }> {
  'use cache'
  cacheLife('minutes')
  cacheTag(`jobs:${tenantId}`)

  const supabase = createPublicClient()
  const page = filter.page || 1
  const from = (page - 1) * JOBS_PER_PAGE
  const to = from + JOBS_PER_PAGE - 1

  let query = supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_name, company_id, city, state,
      employment_type, salary, salary_min, salary_max,
      description, url, published_at, end_date, created_at, source,
      companies!company_id (
        id, name, logo_url, website, linkedin_url, description
      )
    `,
      { count: 'exact' }
    )
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range(from, to)

  // Filter by employment type
  if (filter.type && filter.type !== 'alle') {
    query = query.ilike('employment_type', `%${filter.type}%`)
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
 * Fetch a single job posting by slug.
 * Cached for 1 hour, tagged for on-demand invalidation.
 */
export async function getJobBySlug(
  tenantId: string,
  slug: string
): Promise<JobPosting | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(`job:${slug}`)

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_name, company_id, city, state,
      employment_type, salary, salary_min, salary_max,
      description, url, published_at, end_date, created_at, source,
      companies!company_id (
        id, name, logo_url, website, linkedin_url, description
      )
    `
    )
    .eq('slug', slug)
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
  'use cache'
  cacheLife('hours')
  cacheTag(`related:${excludeId}`)

  if (!city) return []

  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('job_postings')
    .select(
      `
      id, title, slug, company_name, company_id, city, state,
      employment_type, salary, salary_min, salary_max,
      published_at, end_date, created_at, source,
      companies!company_id (
        id, name, logo_url, website, linkedin_url, description
      )
    `
    )
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
