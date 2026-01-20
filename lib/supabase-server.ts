/**
 * Server-side Supabase Authentication Utilities
 *
 * This module provides utilities for handling authentication in Next.js API routes.
 *
 * Usage Guidelines:
 * - Use `getAuthenticatedClient` for API routes that require user authentication
 * - Use `createServiceRoleClient` for API routes that need full data access (bypasses RLS)
 * - Most dashboard APIs use service role for simplicity and performance
 * - Authentication-required APIs are used for user-specific operations
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import type { Database } from './supabase'

/**
 * Create a Supabase client for server-side operations with user authentication.
 * This client respects RLS and requires a valid user session.
 */
export async function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieStore = await cookies()

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  })
}

/**
 * Create a Supabase client from a Next.js request.
 * Useful for API routes that need to authenticate users.
 * Supports both cookie-based and Authorization header authentication.
 */
export function createServerClientFromRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Check for Authorization header first
  const authHeader = request.headers.get('authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  return createSupabaseServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll() {
        // In API routes, we typically don't set cookies
      },
    },
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : {}
    }
  })
}

/**
 * Create a Supabase service role client that bypasses RLS.
 * Should only be used for administrative operations.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Middleware function to authenticate users in API routes.
 * Returns the user if authenticated, throws an error if not.
 */
export async function authenticateUser(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('Unauthorized: Please log in to access this resource')
  }

  return user
}

/**
 * Helper function to handle authentication in API routes.
 * Returns both the supabase client and authenticated user.
 */
export async function getAuthenticatedClient(request: NextRequest) {
  const supabase = createServerClientFromRequest(request)
  const user = await authenticateUser(supabase)
  return { supabase, user }
}
