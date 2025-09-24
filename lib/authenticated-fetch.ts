import { createClient } from '@/lib/supabase'

/**
 * Authenticated fetch wrapper that automatically includes Supabase auth headers
 * This allows existing fetch() calls to work with authentication automatically
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const supabase = createClient()

  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()

  // Create headers object
  const headers = new Headers(init?.headers)

  // Add authorization header if we have a session
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  // Add Content-Type if not already set and we have a body
  // But DON'T add it for FormData - browser will set multipart/form-data automatically
  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  // Make the request with auth headers
  return fetch(input, {
    ...init,
    headers
  })
}

/**
 * Simple wrapper to replace fetch() calls in existing code
 * Usage: Replace fetch() with authFetch()
 */
export const authFetch = authenticatedFetch