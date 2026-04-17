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

/**
 * Service-role Supabase client for admin preview queries only.
 * Bypasses RLS — must ONLY be called from routes that verify an
 * HMAC preview token first. Never expose to public routes.
 */
export function createPreviewServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}
