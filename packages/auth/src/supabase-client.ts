import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { GetTokenFn } from './types'

/**
 * Create a Supabase client authenticated via a Clerk JWT.
 *
 * Uses Clerk's `getToken` with the "supabase" template to obtain a JWT,
 * then passes it as the Authorization header. This enables Supabase RLS
 * policies to use `auth.uid()` which maps to the Clerk user's `sub` claim.
 *
 * @example
 * // In a Server Component or Server Action:
 * import { auth } from '@clerk/nextjs/server'
 * import { createClerkSupabaseClient } from '@lokale-banen/auth'
 *
 * const { getToken } = await auth()
 * const supabase = await createClerkSupabaseClient(getToken)
 * const { data } = await supabase.from('saved_jobs').select('*')
 */
export async function createClerkSupabaseClient(getToken: GetTokenFn) {
  const token = await getToken({ template: 'supabase' })

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    },
  )
}
