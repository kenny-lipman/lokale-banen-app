import type { SupabaseClient } from '@supabase/supabase-js'
import type { JobPosting } from '../types'

export interface GetApprovedJobsOptions {
  platformId: string
  limit?: number
  offset?: number
  filter?: {
    type?: string
    city?: string
    q?: string
    salary_min?: string
    salary_max?: string
  }
}

/**
 * Fetch approved, published job postings for a tenant.
 * Supports filtering by employment type, city, keyword search, and salary range.
 * Results ordered by published_at descending (newest first).
 */
export async function getApprovedJobs(
  supabase: SupabaseClient,
  options: GetApprovedJobsOptions,
): Promise<{ data: JobPosting[]; count: number }> {
  const { platformId, limit = 20, offset = 0, filter } = options

  let query = supabase
    .from('job_postings')
    .select(
      'id, title, slug, company_name, city, state, employment_type, salary_min, salary_max, salary_currency, salary_period, company_logo, published_at, created_at',
      { count: 'exact' },
    )
    .eq('platform_id', platformId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filter?.type) {
    query = query.eq('employment_type', filter.type)
  }
  if (filter?.city) {
    query = query.ilike('city', filter.city)
  }
  if (filter?.q) {
    query = query.or(`title.ilike.%${filter.q}%,company_name.ilike.%${filter.q}%`)
  }
  if (filter?.salary_min) {
    query = query.gte('salary_min', Number(filter.salary_min))
  }
  if (filter?.salary_max) {
    query = query.lte('salary_max', Number(filter.salary_max))
  }

  const { data, count, error } = await query

  if (error) throw new Error(`getApprovedJobs failed: ${error.message}`)

  return { data: (data ?? []) as JobPosting[], count: count ?? 0 }
}

/**
 * Fetch a single job posting by its slug.
 * Matches the short ID at the end of the slug against job_postings.id.
 */
export async function getJobBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<JobPosting | null> {
  // Extract 8-char hex ID from the end of the slug
  const match = slug.match(/([a-f0-9]{8})$/)
  if (!match) return null

  const shortId = match[1]

  const { data, error } = await supabase
    .from('job_postings')
    .select('*')
    .like('id', `${shortId}%`)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // no rows
    throw new Error(`getJobBySlug failed: ${error.message}`)
  }

  return data as JobPosting
}

/**
 * Fetch related jobs based on the same city or company.
 * Excludes the current job. Returns up to `limit` results.
 */
export async function getRelatedJobs(
  supabase: SupabaseClient,
  job: Pick<JobPosting, 'id' | 'city' | 'company_name' | 'platform_id'>,
  limit = 3,
): Promise<JobPosting[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select(
      'id, title, slug, company_name, city, employment_type, salary_min, salary_max, salary_currency, salary_period, company_logo, published_at',
    )
    .eq('platform_id', job.platform_id)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)
    .neq('id', job.id)
    .or(`city.eq.${job.city ?? ''},company_name.eq.${job.company_name ?? ''}`)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRelatedJobs failed: ${error.message}`)

  return (data ?? []) as JobPosting[]
}

/**
 * Count approved published jobs for a platform.
 * Used for publish-guard checks and stats.
 */
export async function getApprovedJobsCount(
  supabase: SupabaseClient,
  platformId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .eq('platform_id', platformId)
    .eq('review_status', 'approved')
    .not('published_at', 'is', null)

  if (error) throw new Error(`getApprovedJobsCount failed: ${error.message}`)

  return count ?? 0
}
