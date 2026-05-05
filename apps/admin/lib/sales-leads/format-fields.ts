import type { NormalizedFields, NormalizedAddress } from '@/lib/services/sales-leads/types'

export function formatAddress(a: NormalizedAddress | undefined): string {
  if (!a) return ''
  if (a.full) return a.full
  const parts = [
    [a.street, a.number].filter(Boolean).join(' '),
    [a.postcode, a.city].filter(Boolean).join(' '),
    a.country,
  ].filter(Boolean)
  return parts.join(', ')
}

/** Display-string voor een bron-alternatief in de dropdown. */
export function formatFieldValue(
  field: keyof NormalizedFields,
  value: unknown,
): string {
  if (value === undefined || value === null) return '—'
  if (field === 'address') return formatAddress(value as NormalizedAddress)
  if (field === 'coordinates' && typeof value === 'object' && value !== null) {
    const v = value as { lat?: number; lng?: number }
    return v.lat !== undefined && v.lng !== undefined ? `${v.lat}, ${v.lng}` : ''
  }
  if (field === 'sbi_activities' && Array.isArray(value)) {
    return value
      .slice(0, 3)
      .map((s: { code: string; description: string }) => `${s.code}·${s.description}`)
      .join(' / ')
  }
  if (field === 'technologies' && Array.isArray(value)) {
    return value.slice(0, 3).map((t: { name: string }) => t.name).join(', ')
  }
  if (Array.isArray(value)) return value.slice(0, 5).join(', ')
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60)
  return String(value)
}
