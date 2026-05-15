// apps/admin/lib/automations/fix-job-postings-geocoding/cities-batch-match.ts

import type { SupabaseClient } from '@supabase/supabase-js'

export interface UniquePrematch {
  kind: 'unique'
  postcode_4digit: string
  platform_id: string
}

export interface AmbiguousPrematch {
  kind: 'ambiguous'
}

export type PrematchEntry = UniquePrematch | AmbiguousPrematch

export interface CityResolver {
  resolve: (cityName: string | null | undefined) => PrematchEntry | null
  size: number
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Bouwt een in-memory resolver uit de cities-tabel.
 * Per unieke plaats houdt 'ie bij of de naam ambigu is (meerdere platform_ids).
 *
 * Unieke match → veilig prematch met postcode + platform_id.
 * Ambigue plaats → terug naar LocationIQ-pad (zodat postcode bepaalt welk platform).
 */
export async function loadCityResolver(supabase: SupabaseClient): Promise<CityResolver> {
  const { data, error } = await supabase
    .from('cities')
    .select('plaats, postcode, platform_id')
    .not('platform_id', 'is', null)
    .not('postcode', 'is', null)

  if (error) {
    console.error('[cities-resolver] load failed:', error.message)
    return { resolve: () => null, size: 0 }
  }

  // Per plaats: verzamel alle unique (postcode, platform_id) combinaties
  const byPlaats = new Map<string, Map<string, string>>() // plaats_lc -> (platform_id -> postcode)

  for (const row of data ?? []) {
    if (!row.plaats || !row.postcode || !row.platform_id) continue
    const key = normalize(row.plaats)
    let inner = byPlaats.get(key)
    if (!inner) {
      inner = new Map()
      byPlaats.set(key, inner)
    }
    // Eerste postcode per platform wint (deterministische volgorde via DB-order ontbreekt; OK want we kiezen alleen platform)
    if (!inner.has(row.platform_id)) {
      inner.set(row.platform_id, row.postcode)
    }
  }

  // Bouw definitieve map: unique vs ambiguous
  const finalMap = new Map<string, PrematchEntry>()
  for (const [plaats, platforms] of byPlaats) {
    if (platforms.size === 1) {
      const [platformId, postcode] = platforms.entries().next().value as [string, string]
      finalMap.set(plaats, { kind: 'unique', postcode_4digit: postcode, platform_id: platformId })
    } else {
      finalMap.set(plaats, { kind: 'ambiguous' })
    }
  }

  function resolve(cityName: string | null | undefined): PrematchEntry | null {
    if (!cityName) return null
    const lc = normalize(cityName)
    if (!lc) return null

    // Exacte match
    const exact = finalMap.get(lc)
    if (exact) return exact

    // Trailing-word strip (1 keer): "Amsterdam Zuid" -> "Amsterdam"
    const lastSpace = lc.lastIndexOf(' ')
    if (lastSpace > 0) {
      const head = lc.slice(0, lastSpace).trim()
      if (head) {
        const stripped = finalMap.get(head)
        if (stripped) return stripped
      }
    }

    return null
  }

  return { resolve, size: finalMap.size }
}
