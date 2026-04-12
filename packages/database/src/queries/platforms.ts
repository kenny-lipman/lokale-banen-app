import type { SupabaseClient } from '@supabase/supabase-js'
import type { Platform } from '../types'

/**
 * Resolve a tenant by its domain hostname.
 * Used in proxy/middleware to map incoming requests to a platform.
 *
 * @example
 * const tenant = await getTenantByDomain(supabase, 'westlandsebanen.nl')
 */
export async function getTenantByDomain(
  supabase: SupabaseClient,
  domain: string,
): Promise<Platform | null> {
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('domain', domain)
    .eq('is_public', true)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // no rows
    throw new Error(`getTenantByDomain failed: ${error.message}`)
  }

  return data as Platform
}

/**
 * Get all platforms marked as public.
 * Used for sitemap generation, cross-linking in footer, etc.
 */
export async function getPublicPlatforms(
  supabase: SupabaseClient,
): Promise<Platform[]> {
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('is_public', true)
    .order('name', { ascending: true })

  if (error) throw new Error(`getPublicPlatforms failed: ${error.message}`)

  return (data ?? []) as Platform[]
}

/**
 * Get the master aggregator platform (lokalebanen.nl).
 * There should be exactly one platform with is_master = true.
 */
export async function getMasterTenant(
  supabase: SupabaseClient,
): Promise<Platform | null> {
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('is_master', true)
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`getMasterTenant failed: ${error.message}`)
  }

  return data as Platform
}
