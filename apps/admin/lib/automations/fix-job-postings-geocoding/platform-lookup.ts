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
    .order('platform_id', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error(`[platform-lookup] ${postcodePrefix}:`, error.message)
    return null
  }
  return data?.platform_id ?? null
}

export interface CityFallback {
  platform_id: string | null
  postcode_4digit: string | null
}

/**
 * Direct cities-tabel lookup op city naam (case-insensitive).
 * Gebruikt als fallback wanneer LocationIQ geen postcode/platform geeft.
 * Returnt null bij geen match of DB-error.
 */
export async function findCityByName(
  supabase: SupabaseClient,
  cityName: string,
): Promise<CityFallback | null> {
  const trimmed = cityName.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('cities')
    .select('platform_id, postcode')
    .ilike('plaats', trimmed)
    .not('postcode', 'is', null)
    .order('platform_id', { ascending: true, nullsFirst: false })
    .order('postcode', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(`[platform-lookup] findCityByName ${trimmed}:`, error.message)
    return null
  }
  if (!data) return null

  return {
    platform_id: data.platform_id ?? null,
    postcode_4digit: data.postcode ?? null,
  }
}
