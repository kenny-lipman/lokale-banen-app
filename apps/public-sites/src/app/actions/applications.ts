'use server'

import { auth } from '@clerk/nextjs/server'
import { createAuthClient } from '@/lib/supabase-auth'
import { getTenant } from '@/lib/tenant'

export async function logApplication(jobId: string) {
  const { userId } = await auth()
  if (!userId) return // anonymous users: don't track

  const tenant = await getTenant()
  if (!tenant) return

  const supabase = await createAuthClient()
  // Upsert to avoid duplicate entries for same user+job
  const { error } = await supabase.from('job_applications').upsert(
    {
      user_id: userId,
      job_posting_id: jobId,
      platform_id: tenant.id,
      method: 'external_redirect',
    },
    { onConflict: 'user_id,job_posting_id' }
  )

  if (error) {
    console.error('Failed to log application:', error)
  }
}

export interface ApplicationWithDetails {
  id: string
  applied_at: string
  method: string | null
  job: {
    id: string
    title: string
    slug: string | null
    city: string | null
    salary: string | null
    company_name: string | null
    company_slug: string | null
  } | null
}

export async function getApplications(): Promise<ApplicationWithDetails[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = await createAuthClient()
  const { data, error } = await supabase
    .from('job_applications')
    .select(
      `
      id, applied_at, method,
      job_postings!job_posting_id (
        id, title, slug, city, salary,
        companies!company_id ( name, slug )
      )
    `
    )
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })

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
      id: row.id as string,
      applied_at: row.applied_at as string,
      method: row.method as string | null,
      job: jobData
        ? {
            id: jobData.id as string,
            title: jobData.title as string,
            slug: jobData.slug as string | null,
            city: jobData.city as string | null,
            salary: jobData.salary as string | null,
            company_name: (company?.name as string) ?? null,
            company_slug: (company?.slug as string) ?? null,
          }
        : null,
    }
  })
}
