/**
 * Detecteert of een career-page URL gehost wordt op een bekend ATS-platform.
 * Match → 100% zekerheid dat het een career-bron is, dus UI mag auto-approven.
 *
 * Slug wordt geëxtraheerd voor V2 ATS-API-extractors (Greenhouse/Recruitee/Lever
 * hebben publieke JSON-API's per slug).
 */

export type AtsType =
  | 'greenhouse'
  | 'recruitee'
  | 'lever'
  | 'workable'
  | 'teamtailor'
  | 'personio'

export type AtsMatch = {
  type: AtsType
  slug: string | null
}

const PATTERNS: Array<{ re: RegExp; type: AtsType; slugIndex: number | null }> = [
  // Greenhouse embed met query (pre-canonical) — vang slug eerst (most-specific).
  { re: /^https?:\/\/boards\.greenhouse\.io\/embed\/job_board\?for=([^&#]+)/i, type: 'greenhouse', slugIndex: 1 },
  // Greenhouse embed zonder query (canonical, query gestript) — herken nog steeds als ATS.
  { re: /^https?:\/\/boards\.greenhouse\.io\/embed\/job_board(?:[/?]|$)/i, type: 'greenhouse', slugIndex: null },
  // Greenhouse direct: boards.greenhouse.io/{slug}
  { re: /^https?:\/\/boards\.greenhouse\.io\/([^/?#]+)/i, type: 'greenhouse', slugIndex: 1 },
  // Recruitee: {slug}.recruitee.com (any path), inclusief /o/{job}
  { re: /^https?:\/\/([a-z0-9-]+)\.recruitee\.com/i, type: 'recruitee', slugIndex: 1 },
  // Lever: jobs.lever.co/{slug}
  { re: /^https?:\/\/jobs\.lever\.co\/([^/?#]+)/i, type: 'lever', slugIndex: 1 },
  // Workable: apply.workable.com/{slug}, {slug}.workable.com
  { re: /^https?:\/\/apply\.workable\.com\/([^/?#]+)/i, type: 'workable', slugIndex: 1 },
  { re: /^https?:\/\/([a-z0-9-]+)\.workable\.com/i, type: 'workable', slugIndex: 1 },
  // Teamtailor: {slug}.teamtailor.com
  { re: /^https?:\/\/([a-z0-9-]+)\.teamtailor\.com/i, type: 'teamtailor', slugIndex: 1 },
  // Personio: {slug}.jobs.personio.com (NL/DE), {slug}.jobs.personio.de
  { re: /^https?:\/\/([a-z0-9-]+)\.jobs\.personio\.(?:com|de)/i, type: 'personio', slugIndex: 1 },
]

export function detectAts(url: string): AtsMatch | null {
  if (!url) return null
  for (const p of PATTERNS) {
    const m = url.match(p.re)
    if (m) {
      return {
        type: p.type,
        slug: p.slugIndex !== null ? (m[p.slugIndex] ?? null) : null,
      }
    }
  }
  return null
}
