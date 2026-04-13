'use server'

import { auth } from '@clerk/nextjs/server'
import { createAuthClient } from '@/lib/supabase-auth'
import { getTenant } from '@/lib/tenant'
import { revalidatePath } from 'next/cache'

export async function saveJob(jobId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Not authenticated')

  const tenant = await getTenant()
  if (!tenant) throw new Error('No tenant')

  const supabase = await createAuthClient()
  const { error } = await supabase.from('saved_jobs').upsert(
    {
      user_id: userId,
      job_posting_id: jobId,
      platform_id: tenant.id,
    },
    { onConflict: 'user_id,job_posting_id' }
  )

  if (error) {
    console.error('Failed to save job:', error)
    throw new Error('Failed to save job')
  }

  revalidatePath('/account/opgeslagen')
}

export async function unsaveJob(jobId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Not authenticated')

  const supabase = await createAuthClient()
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('user_id', userId)
    .eq('job_posting_id', jobId)

  if (error) {
    console.error('Failed to unsave job:', error)
    throw new Error('Failed to unsave job')
  }

  revalidatePath('/account/opgeslagen')
}

export async function isJobSaved(jobId: string): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false

  const supabase = await createAuthClient()
  const { count } = await supabase
    .from('saved_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('job_posting_id', jobId)

  return (count ?? 0) > 0
}

export interface SavedJobWithDetails {
  job_posting_id: string
  saved_at: string
  job: {
    id: string
    title: string
    slug: string | null
    city: string | null
    salary: string | null
    employment: string | null
    published_at: string | null
    company_name: string | null
    company_slug: string | null
    company_logo: string | null
  } | null
}

export async function getSavedJobs(): Promise<SavedJobWithDetails[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createAuthClient()
  const { data, error } = await supabase
    .from('saved_jobs')
    .select(
      `
      job_posting_id, saved_at,
      job_postings!job_posting_id (
        id, title, slug, city, salary, employment, published_at,
        companies!company_id ( name, slug, logo_url )
      )
    `
    )
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })

  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((row) => {
    const jp = Array.isArray(row.job_postings)
      ? row.job_postings[0]
      : row.job_postings
    const jobData = jp as Record<string, unknown> | null
    const company = jobData
      ? (Array.isArray(jobData.companies) ? jobData.companies[0] : jobData.companies) as Record<string, unknown> | null
      : null

    return {
      job_posting_id: row.job_posting_id as string,
      saved_at: row.saved_at as string,
      job: jobData
        ? {
            id: jobData.id as string,
            title: jobData.title as string,
            slug: jobData.slug as string | null,
            city: jobData.city as string | null,
            salary: jobData.salary as string | null,
            employment: jobData.employment as string | null,
            published_at: jobData.published_at as string | null,
            company_name: (company?.name as string) ?? null,
            company_slug: (company?.slug as string) ?? null,
            company_logo: (company?.logo_url as string) ?? null,
          }
        : null,
    }
  })
}
