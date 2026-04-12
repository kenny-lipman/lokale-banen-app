/**
 * Format a date relative to now in Dutch.
 * Returns "Vandaag", "Gisteren", "3 dagen geleden", "2 weken geleden", etc.
 *
 * @example
 * formatRelative(new Date()) // => 'Vandaag'
 * formatRelative('2026-04-08T12:00:00Z') // => '2 dagen geleden' (if today is Apr 10)
 */
export function formatRelative(date: string | Date): string {
  const now = new Date()
  const target = typeof date === 'string' ? new Date(date) : date

  const diffMs = now.getTime() - target.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'

  const rtf = new Intl.RelativeTimeFormat('nl', { numeric: 'auto' })

  if (diffDays < 7) {
    return rtf.format(-diffDays, 'day')
  }

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) {
    return rtf.format(-diffWeeks, 'week')
  }

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    return rtf.format(-diffMonths, 'month')
  }

  const diffYears = Math.floor(diffDays / 365)
  return rtf.format(-diffYears, 'year')
}
