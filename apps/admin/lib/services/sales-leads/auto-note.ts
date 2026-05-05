import type { MasterRecord, RunEnrichments, NormalizedFields, NormalizedVacancy } from './types'
import { detectDiscrepancies } from './master-record'

function fmtAddress(a: NormalizedFields['address']): string {
  if (!a) return '—'
  const parts = [
    [a.street, a.number].filter(Boolean).join(' '),
    [a.postcode, a.city].filter(Boolean).join(' '),
    a.country,
  ]
  return parts.filter(Boolean).join(', ')
}

function fmtList(items: string[] | undefined, max = 5): string {
  if (!items?.length) return '—'
  const slice = items.slice(0, max)
  return slice.join(', ') + (items.length > max ? ` … (+${items.length - max})` : '')
}

function fmtSocial(m: MasterRecord): string[] {
  const out: string[] = []
  if (m.linkedin_url) out.push(`- LinkedIn: ${m.linkedin_url}`)
  if (m.twitter_url) out.push(`- Twitter/X: ${m.twitter_url}`)
  if (m.facebook_url) out.push(`- Facebook: ${m.facebook_url}`)
  if (m.instagram_url) out.push(`- Instagram: ${m.instagram_url}`)
  if (m.tiktok_url) out.push(`- TikTok: ${m.tiktok_url}`)
  return out
}

function fmtVacancies(vs: NormalizedVacancy[] | undefined): string {
  if (!vs?.length) return '_Geen vacatures geselecteerd._'
  return vs
    .map((v) => `- ${v.title}${v.url ? ` — ${v.url}` : ''}${v.location ? ` _(${v.location})_` : ''}`)
    .join('\n')
}

/**
 * Genereert deal-notitie markdown (sectie 5.2.6 spec).
 * Bevat: bedrijfsprofiel · activiteit · departement-distributie · technologie ·
 * online aanwezigheid · vacatures · bron-discrepanties.
 *
 * `selectedVacancies` is de subset die de user heeft aangevinkt (mag empty zijn
 * tijdens initial generation; wordt later overschreven via PATCH).
 */
export function generateDealNote(opts: {
  master: MasterRecord
  enrichments: RunEnrichments
  selectedVacancies?: NormalizedVacancy[]
}): string {
  const { master: m, enrichments } = opts
  const vacs = opts.selectedVacancies ?? m.vacancies ?? []

  const blocks: string[] = []

  // Bedrijfsprofiel
  blocks.push(
    [
      `## Bedrijfsprofiel`,
      `- Naam: ${m.company_name ?? '—'}`,
      `- KvK: ${m.kvk_number ?? '—'}${m.rsin ? ` · RSIN ${m.rsin}` : ''}`,
      `- Rechtsvorm: ${m.legal_form ?? '—'}`,
      `- Adres: ${fmtAddress(m.address)}`,
      `- Opgericht: ${m.founded_date ?? m.founded_year ?? '—'}`,
      `- Medewerkers: ${m.employee_count ?? '—'}${m.employee_bucket ? ` _(${m.employee_bucket})_` : ''}`,
    ].join('\n'),
  )

  // Activiteit
  const sbiLines = (m.sbi_activities ?? [])
    .slice(0, 5)
    .map((s) => `  - ${s.code} · ${s.description}${s.is_main ? ' _(hoofd)_' : ''}`)
  blocks.push(
    [
      `## Activiteit`,
      `- Branche: ${m.industry ?? '—'}`,
      ...(m.industry_codes?.length ? [`- Apollo industry-codes: ${fmtList(m.industry_codes)}`] : []),
      ...(sbiLines.length ? [`- KvK SBI:`, ...sbiLines] : []),
      ...(m.description_short ? [``, m.description_short] : []),
    ].join('\n'),
  )

  // Departement-distributie
  const dept = m.departmental_head_count
  if (dept && Object.keys(dept).length) {
    const lines = Object.entries(dept)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([k, v]) => `  - ${k}: ${v}`)
    blocks.push([`## Departement-distributie (Apollo)`, ...lines].join('\n'))
  }

  // Tech-stack
  if (m.technologies?.length) {
    const top = m.technologies.slice(0, 5).map((t) => `  - ${t.name}${t.category && t.category !== 'unknown' ? ` _(${t.category})_` : ''}`)
    blocks.push([`## Technology stack`, ...top].join('\n'))
  }

  // Online aanwezigheid
  const social = fmtSocial(m)
  if (social.length || m.blog_post_count) {
    blocks.push(
      [
        `## Online aanwezigheid`,
        ...social,
        ...(m.blog_post_count
          ? [`- Blog: ${m.blog_post_count} posts${m.blog_last_post_date ? ` _(laatste ${m.blog_last_post_date})_` : ''}`]
          : []),
      ].join('\n'),
    )
  }

  // Vacatures
  blocks.push([`## Vacatures`, fmtVacancies(vacs)].join('\n'))

  // Bron-discrepanties (informatief)
  const discr = detectDiscrepancies(enrichments)
  if (discr.length) {
    const lines = discr.map(
      (d) =>
        `  - **${String(d.field)}**: ` +
        d.values.map((v) => `${v.source}=${JSON.stringify(v.value)}`).join(' · '),
    )
    blocks.push([`## Bron-discrepanties`, ...lines].join('\n'))
  }

  return blocks.join('\n\n')
}
