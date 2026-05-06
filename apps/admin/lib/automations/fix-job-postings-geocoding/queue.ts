// apps/admin/lib/automations/fix-job-postings-geocoding/queue.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export interface QueueRow {
  id: string
  location: string | null
  city: string | null
  zipcode: string | null
  street: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

export async function fetchQueueBatch(supabase: SupabaseClient, limit: number): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from('job_postings')
    .select('id, location, city, zipcode, street, country, latitude, longitude')
    .not('location', 'is', null)
    .neq('location', '')
    .neq('location', 'The Randstad, Netherlands')
    .is('geocoding_failed', null)
    .or('zipcode.is.null,zipcode.eq.,latitude.is.null,longitude.is.null')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`queue fetch: ${error.message}`)
  return (data ?? []) as QueueRow[]
}

export async function countQueueRemaining(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('job_postings')
    .select('id', { count: 'exact', head: true })
    .not('location', 'is', null)
    .neq('location', '')
    .neq('location', 'The Randstad, Netherlands')
    .is('geocoding_failed', null)
    .or('zipcode.is.null,zipcode.eq.,latitude.is.null,longitude.is.null')
  if (error) {
    console.error('[queue] count failed:', error.message)
    return -1
  }
  return count ?? 0
}
