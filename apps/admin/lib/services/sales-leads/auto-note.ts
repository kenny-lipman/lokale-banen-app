import type { MasterRecord, NormalizedContact, NormalizedVacancy } from './types'
import { getBrancheLabel, findEnumIdForSbi } from './branche-options.service'
import { composeAddressString } from './pipedrive-payloads'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * HTML-escape voor user-supplied text. Pipedrive notes worden in HTML gerendered
 * (TinyMCE-clone) — XSS-protection is verplicht omdat content uit Apollo/website
 * scrape komt en niet inherent vertrouwd is.
 */
function esc(s: unknown): string {
  if (s === undefined || s === null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Veilig URL-escape voor href. Sta alleen http/https/mailto toe; alles anders
 * wordt platte tekst (geen <a>).
 */
function safeUrl(url: string | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) return null
  return esc(trimmed)
}

function fmtFounded(m: MasterRecord): string | null {
  if (m.founded_year) return String(m.founded_year)
  if (m.founded_date) {
    const yr = m.founded_date.match(/^\d{4}/)?.[0]
    if (yr) return yr
  }
  return null
}

function fmtEmployees(m: MasterRecord): string | null {
  if (typeof m.employee_count === 'number' && m.employee_count > 0) {
    return `${m.employee_count} medewerkers`
  }
  if (m.employee_bucket) return m.employee_bucket
  return null
}

function joinWithSep(parts: Array<string | null | undefined>, sep = ' · '): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join(sep)
}

function renderCompanyBlock(m: MasterRecord, brancheLabel: string | null): string {
  const lines: string[] = []
  if (m.company_name) lines.push(`<strong>${esc(m.company_name)}</strong>`)

  const kvkLine = joinWithSep([
    m.kvk_number ? `KvK ${esc(m.kvk_number)}` : null,
    fmtEmployees(m),
    fmtFounded(m) ? `opgericht ${esc(fmtFounded(m))}` : null,
  ])
  if (kvkLine) lines.push(kvkLine)

  const addr = composeAddressString(m.address)
  if (addr) lines.push(esc(addr))

  if (brancheLabel) lines.push(`Branche: ${esc(brancheLabel)}`)

  if (lines.length === 0) return ''
  return `<h3>Bedrijf</h3>\n<p>${lines.join('<br>\n')}</p>`
}

function renderContactBlock(c: NormalizedContact | undefined): string {
  if (!c) return ''
  const lines: string[] = []
  const titlePart = c.title ? ` - ${esc(c.title)}` : ''
  lines.push(`<strong>${esc(c.name)}</strong>${titlePart}`)

  const emailUrl = safeUrl(c.email ? `mailto:${c.email}` : undefined)
  const emailLine = emailUrl && c.email ? `<a href="${emailUrl}">${esc(c.email)}</a>` : null
  const phone = c.phone_mobile ?? c.phone_other
  const contactLine = joinWithSep([emailLine, phone ? esc(phone) : null])
  if (contactLine) lines.push(contactLine)

  return `<h3>Contact</h3>\n<p>${lines.join('<br>\n')}</p>`
}

function renderVacanciesBlock(vacancies: NormalizedVacancy[] | undefined): string {
  if (!vacancies || vacancies.length === 0) {
    return `<h3>Vacatures</h3>\n<p><em>Geen actuele vacatures gevonden.</em></p>`
  }
  const items = vacancies
    .map((v) => {
      const url = safeUrl(v.url)
      const title = esc(v.title)
      const loc = v.location ? ` - ${esc(v.location)}` : ''
      return url
        ? `  <li><a href="${url}">${title}</a>${loc}</li>`
        : `  <li>${title}${loc}</li>`
    })
    .join('\n')
  return `<h3>Vacatures</h3>\n<ul>\n${items}\n</ul>`
}

/**
 * Genereert deal-notitie als HTML voor Pipedrive (variant C, sectie 5.2.6 spec).
 * Pipedrive notes-editor accepteert beperkte HTML: <h3>, <p>, <strong>, <em>,
 * <ul><li>, <a href>, <br>. Geen <style>/CSS/classes — wordt gestript.
 *
 * Drie secties (alleen tonen als gevuld):
 *   1. Bedrijf - naam, KvK, medewerkers, opgericht, adres, branche
 *   2. Contact - primary contact uit master.contacts[0]
 *   3. Vacatures - lijst van titels met links
 *
 * `brancheEnumId` wordt vertaald naar label via BrancheOptionsService.
 * Wanneer null/onbekend: branche-regel wordt overgeslagen.
 */
export async function generateDealNote(opts: {
  master: MasterRecord
  selectedVacancies?: NormalizedVacancy[]
  brancheEnumId?: number | null
  supabase?: SupabaseClient
}): Promise<string> {
  const { master: m } = opts
  const vacs = opts.selectedVacancies ?? m.vacancies ?? []
  const primaryContact = m.contacts?.[0]

  // Resolve branche-label: explicit override -> master.branche_suggestion -> SBI-fallback
  let brancheEnumId = opts.brancheEnumId ?? null
  if (brancheEnumId == null) {
    const suggestion = m.branche_suggestion?.enum_id
    if (typeof suggestion === 'number') {
      brancheEnumId = suggestion
    } else {
      const firstSbi = m.industry_codes?.[0] ?? m.sbi_activities?.[0]?.code
      brancheEnumId = await findEnumIdForSbi(firstSbi, opts.supabase)
    }
  }
  const brancheLabel = await getBrancheLabel(brancheEnumId, opts.supabase)

  const blocks = [
    renderCompanyBlock(m, brancheLabel),
    renderContactBlock(primaryContact),
    renderVacanciesBlock(vacs),
  ].filter((b) => b.length > 0)

  return blocks.join('\n\n')
}
