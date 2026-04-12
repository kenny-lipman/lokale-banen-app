import type { SupabaseClient } from '@supabase/supabase-js'
import type { SavedJob, JobApplication } from '../types'

/**
 * Get all saved jobs for a user.
 * Joins with job_postings to return full job data alongside the save record.
 */
export async function getSavedJobs(
  supabase: SupabaseClient,
  userId: string,
): Promise<SavedJob[]> {
  const { data, error } = await supabase
    .from('saved_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getSavedJobs failed: ${error.message}`)

  return (data ?? []) as SavedJob[]
}

/**
 * Save a job posting for a user.
 * Uses upsert to prevent duplicate saves.
 */
export async function saveJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  platformId: string,
): Promise<SavedJob> {
  const { data, error } = await supabase
    .from('saved_jobs')
    .upsert(
      {
        user_id: userId,
        job_posting_id: jobId,
        platform_id: platformId,
      },
      { onConflict: 'user_id,job_posting_id' },
    )
    .select()
    .single()

  if (error) throw new Error(`saveJob failed: ${error.message}`)

  return data as SavedJob
}

/**
 * Remove a saved job for a user.
 */
export async function removeSavedJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
): Promise<void> {
  const { error } = await supabase
    .from('saved_jobs')
    .delete()
    .eq('user_id', userId)
    .eq('job_posting_id', jobId)

  if (error) throw new Error(`removeSavedJob failed: ${error.message}`)
}

/**
 * Log that a user clicked through to apply for a job.
 * Used for tracking application intent (external redirect).
 */
export async function logApplication(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  platformId: string,
): Promise<JobApplication> {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      user_id: userId,
      job_posting_id: jobId,
      platform_id: platformId,
    })
    .select()
    .single()

  if (error) throw new Error(`logApplication failed: ${error.message}`)

  return data as JobApplication
}
