// apps/admin/lib/automations/fix-job-postings-geocoding/platform-lookup.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export function extractPostcodePrefix(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const match = postcode.match(/^(\d{4})/)
  return match ? match[1] : null
}

/**
 * Lookup platform_id voor de eerste-4-cijfers van een postcode.
 * Returnt null als geen city-row gevonden of geen platform_id heeft.
 */
export async function findPlatformIdByPostcode(
  supabase: SupabaseClient,
  postcodePrefix: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('cities')
    .select('platform_id')
    .eq('postcode', postcodePrefix)
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error(`[platform-lookup] ${postcodePrefix}:`, error.message)
    return null
  }
  return data?.platform_id ?? null
}
