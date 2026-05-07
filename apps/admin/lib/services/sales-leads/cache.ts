import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'

type CacheRow = {
  source: string
  cache_key: string
  response: unknown
  expires_at: string
}

export type CacheSource =
  | 'kvk_zoeken' | 'kvk_basisprofiel'
  | 'google_maps_find' | 'google_maps_details' | 'apify_maps'
  | 'apollo_org'
  | 'website_page'
  | 'pipedrive_users' | 'pipedrive_pipelines' | 'pipedrive_stages' | 'pipedrive_deal_fields_date'

export type TTL = '1h' | '24h' | '7d' | '30d'

const TTL_MS: Record<TTL, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/**
 * Generieke cache-wrapper rond `enrichment_cache`. Composite PK: (source, cache_key).
 * - Cache-hit (niet expired) → response uit DB
 * - Anders fetcher() runnen + upsert
 * Returns `{ value, fromCache }` zodat de caller cache-status in audit log kan zetten.
 */
export async function cachedFetch<T>(
  source: CacheSource,
  cacheKey: string,
  ttl: TTL,
  fetcher: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const supabase = createServiceRoleClient()

  const { data: row } = await supabase
    .from('enrichment_cache')
    .select('source, cache_key, response, expires_at')
    .eq('source', source)
    .eq('cache_key', cacheKey)
    .maybeSingle<CacheRow>()

  if (row && new Date(row.expires_at).getTime() > Date.now()) {
    return { value: row.response as T, fromCache: true }
  }

  const fresh = await fetcher()

  const { error: upsertError } = await supabase.from('enrichment_cache').upsert({
    source,
    cache_key: cacheKey,
    response: fresh as unknown as Json,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + TTL_MS[ttl]).toISOString(),
  })
  if (upsertError) {
    console.warn(`[enrichment_cache] upsert faalde source=${source} key=${cacheKey}: ${upsertError.message}`)
  }

  return { value: fresh, fromCache: false }
}

/**
 * Invalidate alle cache-entries van een specifieke source.
 */
export async function invalidateCacheSource(source: CacheSource): Promise<void> {
  const supabase = createServiceRoleClient()
  await supabase.from('enrichment_cache').delete().eq('source', source)
}
