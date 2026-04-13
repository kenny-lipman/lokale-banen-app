import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a hex color into r, g, b components (0-255).
 */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}

/**
 * Convert r, g, b (0-255) back to a hex string.
 */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

/**
 * Generate a light tint of a hex color (mix with white at given opacity).
 * E.g. hexToLightVariant('#006B5E', 0.08) produces a very light greenish tint.
 */
export function hexToLightVariant(hex: string, opacity: number): string {
  const parsed = parseHex(hex)
  if (!parsed) return '#E8F5F2'
  // Mix with white: result = white * (1 - opacity) + color * opacity
  const r = 255 * (1 - opacity) + parsed.r * opacity
  const g = 255 * (1 - opacity) + parsed.g * opacity
  const b = 255 * (1 - opacity) + parsed.b * opacity
  return toHex(r, g, b)
}

/**
 * Darken a hex color by a given factor (0-1).
 * E.g. darkenHex('#006B5E', 0.1) darkens by 10%.
 */
export function darkenHex(hex: string, factor: number): string {
  const parsed = parseHex(hex)
  if (!parsed) return '#005A4F'
  const r = parsed.r * (1 - factor)
  const g = parsed.g * (1 - factor)
  const b = parsed.b * (1 - factor)
  return toHex(r, g, b)
}

/**
 * Generate a muted (desaturated lighter) variant of a hex color.
 */
export function hexToMutedVariant(hex: string): string {
  const parsed = parseHex(hex)
  if (!parsed) return '#B2DDD5'
  // Mix with a light gray at ~35% opacity
  const r = 200 * 0.65 + parsed.r * 0.35
  const g = 210 * 0.65 + parsed.g * 0.35
  const b = 205 * 0.65 + parsed.b * 0.35
  return toHex(r, g, b)
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
