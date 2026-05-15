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
 * Compute WCAG relative luminance (0-1) of a hex color.
 */
function relativeLuminance(hex: string): number | null {
  const parsed = parseHex(hex)
  if (!parsed) return null
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * toLinear(parsed.r) +
    0.7152 * toLinear(parsed.g) +
    0.0722 * toLinear(parsed.b)
  )
}

/**
 * Return the best contrast ink color (#FFFFFF or #0A0A0A) for a given
 * background hex. Uses WCAG relative luminance.
 */
export function getContrastInk(hex: string): string {
  const L = relativeLuminance(hex)
  if (L === null) return '#FFFFFF'
  return L > 0.45 ? '#0A0A0A' : '#FFFFFF'
}

/**
 * Pick the right link-kleur op witte achtergrond. Een aantal portals
 * (OssenseBanen, HoornseBanen, ZaanstadseBanen, ZaanstreekseBanen) hebben
 * een te lichte secondary om als body-link op witte bg te gebruiken
 * (WCAG AA fail). Fallback naar primary in die gevallen.
 *
 * Werkt op luminance: > 0.45 = te licht voor witte bg.
 */
export function getLinkColor(secondary: string, primary: string): string {
  const L = relativeLuminance(secondary)
  if (L === null) return primary
  return L > 0.45 ? primary : secondary
}

/**
 * Format a date as a relative time string in Dutch.
 * Uses day-level granularity to avoid stale "2 uur geleden" on cached pages.
 */
export function formatRelative(date: string | Date): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Vandaag'
  if (diffDays === 1) return 'Gisteren'
  if (diffDays < 7) return `${diffDays} dagen geleden`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weken geleden`

  // Meer dan een maand: toon datum
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
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
 * Strip "--" artefacten uit content (typisch ChatGPT/Mistral-output dat de
 * site er AI-gegenereerd uit doet zien). Markdown horizontal-rules (`---` op
 * eigen regel) blijven behouden.
 */
export function stripChatGptArtifacts(input: string): string {
  if (!input) return input
  return input
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (/^-{3,}\s*$/.test(trimmed)) return line // markdown <hr>
      return line.replace(/\s+-{2,}(?=\s|$)/g, '')
    })
    .join('\n')
}

/**
 * Compute the great-circle distance between two coordinates (km).
 * Haversine formula - accurate enough for regional distances.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

