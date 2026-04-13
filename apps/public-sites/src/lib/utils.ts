import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a hex color string to HSL values string (e.g. "221 83% 53%").
 * Used for tenant theme injection into CSS custom properties.
 */
export function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '221 83% 53%' // fallback default blue

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/**
 * Format a date as a relative time string in Dutch.
 * Uses Intl.RelativeTimeFormat (no external deps).
 */
export function formatRelative(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Zojuist'
  if (diffMinutes < 60) return `${diffMinutes} min geleden`
  if (diffHours < 24) return `${diffHours}u geleden`
  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) return `${diffDays} dagen geleden`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weken geleden`

  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date))
}

/**
 * Generate a URL-safe slug from a title and ID.
 */
export function createSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug}-${id.slice(0, 8)}`
}

/**
 * Build a human-readable employment label from the employment field and job_type array.
 * DB schema: employment = 'Vast'|'Tijdelijk'|etc., job_type = ['Fulltime']|['Parttime']|etc.
 */
export function formatEmploymentLabel(
  employment: string | null | undefined,
  jobType: string[] | null | undefined
): string {
  const parts: string[] = []
  if (jobType && jobType.length > 0) {
    parts.push(...jobType)
  }
  if (employment) {
    parts.push(employment)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Onbekend'
}
