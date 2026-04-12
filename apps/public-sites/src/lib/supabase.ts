import { createClient } from '@supabase/supabase-js'

/**
 * Public Supabase client using the anon key.
 * Read-only access for public data (approved jobs, public platforms).
 * RLS policies enforce data visibility.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
    }
  )
}
