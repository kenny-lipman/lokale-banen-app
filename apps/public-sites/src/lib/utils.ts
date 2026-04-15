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
 * Return the best contrast ink color (#FFFFFF or #1A1815) for a given
 * background hex. Uses WCAG relative luminance.
 */
export function getContrastInk(hex: string): string {
  const parsed = parseHex(hex)
  if (!parsed) return '#FFFFFF'
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L =
    0.2126 * toLinear(parsed.r) +
    0.7152 * toLinear(parsed.g) +
    0.0722 * toLinear(parsed.b)
  return L > 0.45 ? '#1A1815' : '#FFFFFF'
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

/**
 * Sanitize raw HTML by stripping dangerous tags and attributes.
 * Used when rendering scraped job descriptions that are not markdown.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '')
    .replace(/javascript\s*:/gi, 'nojavascript:')
    .replace(/data\s*:\s*text\/html/gi, 'nodata:text/html')
}

/**
 * Render a simple markdown string to HTML.
 * Supports ## headings, ### headings, **bold**, - list items, and paragraphs.
 * No external dependencies.
 */
export function renderMarkdown(text: string): string {
  // Escape HTML entities first to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const lines = escaped.split('\n')
  const blocks: string[] = []
  let currentParagraph: string[] = []
  let inList = false

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join(' ').trim()
      if (content) {
        blocks.push(`<p class="mb-4 leading-relaxed">${applyInline(content)}</p>`)
      }
      currentParagraph = []
    }
  }

  function flushList() {
    if (inList) {
      blocks.push('</ul>')
      inList = false
    }
  }

  function applyInline(str: string): string {
    // Bold: **text**
    return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Empty line: flush current paragraph
    if (trimmed === '') {
      flushParagraph()
      flushList()
      continue
    }

    // ## Heading 2
    if (trimmed.startsWith('## ')) {
      flushParagraph()
      flushList()
      const heading = trimmed.slice(3).trim()
      blocks.push(`<h2 class="text-h2 font-semibold mt-8 mb-4">${applyInline(heading)}</h2>`)
      continue
    }

    // ### Heading 3
    if (trimmed.startsWith('### ')) {
      flushParagraph()
      flushList()
      const heading = trimmed.slice(4).trim()
      blocks.push(`<h3 class="text-body-medium font-semibold mt-6 mb-3">${applyInline(heading)}</h3>`)
      continue
    }

    // - List item
    if (trimmed.startsWith('- ')) {
      flushParagraph()
      if (!inList) {
        blocks.push('<ul class="list-disc pl-6 mb-4 space-y-1">')
        inList = true
      }
      blocks.push(`<li class="leading-relaxed">${applyInline(trimmed.slice(2).trim())}</li>`)
      continue
    }

    // Regular text line
    flushList()
    currentParagraph.push(trimmed)
  }

  flushParagraph()
  flushList()

  return blocks.join('\n')
}
