/**
 * Authenticated API Client
 * Automatically includes user session token in API requests
 */

import { getSupabaseClient } from './supabase'

/**
 * Make an authenticated API request
 * Automatically includes the current user's session token
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No authentication session found')
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * Simple wrapper for authenticated GET requests
 */
export async function authenticatedGet(url: string, options: RequestInit = {}) {
  return authenticatedFetch(url, { ...options, method: 'GET' })
}

/**
 * Simple wrapper for authenticated POST requests
 */
export async function authenticatedPost(url: string, body?: any, options: RequestInit = {}) {
  return authenticatedFetch(url, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}