import { createClient } from '@supabase/supabase-js'

/**
 * Create a public Supabase client using the anon key.
 * Suitable for client-side or server-side read-only operations
 * where RLS policies control access.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Create a Supabase client using the service role key.
 * Bypasses RLS — only use server-side in trusted contexts.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
