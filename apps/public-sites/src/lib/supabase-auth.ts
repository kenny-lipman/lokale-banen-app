import { auth } from '@clerk/nextjs/server'
import { createClerkSupabaseClient } from '@lokale-banen/auth'

/**
 * Create authenticated Supabase client using Clerk JWT.
 * Use in Server Components and Server Actions for user-scoped queries.
 * Requires the Clerk JWT template "supabase" to be configured.
 */
export async function createAuthClient() {
  const { getToken } = await auth()
  return createClerkSupabaseClient(getToken)
}
