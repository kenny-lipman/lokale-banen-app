import type {
  RunEnrichments,
  NormalizedFields,
  SourceKey,
} from '@/lib/services/sales-leads/types'

export type SourceAlternative = {
  source: SourceKey
  value: unknown
  isPrimary: boolean
}

const SOURCES: Array<Exclude<SourceKey, 'custom'>> = [
  'kvk',
  'google_maps',
  'apollo',
  'website',
]

function isPresent(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Object.keys(v as object).length > 0
  return true
}

/** Lijst alternatieven uit elke bron die een non-empty waarde heeft voor `field`,
 *  plus de huidige primary-source markering (uit `source_overrides`). */
export function getSourceAlternatives(
  field: keyof NormalizedFields,
  enrichments: RunEnrichments,
  currentSource: SourceKey | undefined,
): SourceAlternative[] {
  const out: SourceAlternative[] = []
  for (const src of SOURCES) {
    const parsed = enrichments[src]?.parsed
    const v = parsed?.[field]
    if (!isPresent(v)) continue
    out.push({ source: src, value: v, isPrimary: src === currentSource })
  }
  return out
}

export const SOURCE_LABEL: Record<SourceKey, string> = {
  kvk: 'KvK',
  google_maps: 'Maps',
  apollo: 'Apollo',
  website: 'Website',
  custom: 'Custom',
}
