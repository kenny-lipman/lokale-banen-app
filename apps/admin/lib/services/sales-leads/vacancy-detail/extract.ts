/**
 * Gedeelde vacature-detail-extractor.
 *
 * Haalt een vacature-detailpagina op en extraheert gestructureerde velden.
 * Twee paden:
 *   1. JSON-LD JobPosting (vaak op ATS-pagina's): salary, employment, job_type,
 *      description, published_at, end_date via het strict Zod-schema.
 *   2. Geen (bruikbare) JSON-LD (de meeste eigen werkenbij-pagina's): de
 *      page-markdown wordt de description.
 * In beide paden draait Mistral op de description voor working_hours,
 * education_level, career_level en categories.
 *
 * Gebruikt door:
 *   - de website-stap (inline, op het kritieke pad van de run)
 *   - de career-page-detail achtergrond-worker (vangnet voor de overflow)
 *
 * Hergebruikt de werkenindekempen-parsers en de sales-leads fetch-infra.
 */

import type { TablesUpdate } from '@/lib/supabase'
import type { PlaywrightFetcher } from '@/lib/services/sales-leads/website/playwright-fetcher'
import { tieredFetch } from '@/lib/services/sales-leads/website/tiered-fetch'
import { htmlToMarkdown } from '@/lib/services/sales-leads/website/markdown'
import {
  SsrfBlockedError,
  FetchSizeExceededError,
} from '@/lib/services/sales-leads/website/ssrf-fetch'
import {
  parseDetailHtml,
  JobPostingValidationError,
} from '@/lib/scrapers/werkenindekempen/detail-parser'
import {
  extractFromDescription,
  emptyMistralResult,
} from '@/lib/scrapers/werkenindekempen/ai-parser'
import * as N from '@/lib/scrapers/werkenindekempen/normalizers'
import type { NormalizedVacancy, VacancyDetailFields } from '@/lib/services/sales-leads/types'

export type { VacancyDetailFields }

export type DetailFetchOutcome =
  | { status: 'ok'; fields: VacancyDetailFields }
  | { status: 'blocked' }
  | { status: 'error'; message: string }

export function emptyDetailFields(): VacancyDetailFields {
  return {
    salary: null,
    employment: null,
    job_type: null,
    description: null,
    published_at: null,
    end_date: null,
    education_level: null,
    career_level: null,
    working_hours_min: null,
    working_hours_max: null,
    categories: null,
  }
}

/**
 * Extraheer de structurele velden uit reeds-opgehaalde HTML (synchroon, geen
 * netwerk). Returnt de velden plus de plain-text description die als Mistral-
 * input dient. Apart van de Mistral-stap zodat dit deterministisch te testen is.
 */
export function parseStructuredDetail(
  html: string,
  finalUrl: string,
): { fields: VacancyDetailFields; descriptionText: string } {
  const fields = emptyDetailFields()
  let descriptionText = ''

  try {
    const jp = parseDetailHtml(html, finalUrl)
    const employment = N.normalizeEmploymentType(jp.employmentType)
    const salary = N.parseSalary(jp.baseSalary)
    descriptionText = N.stripHtml(jp.description ?? '')
    fields.description = jp.description || null
    fields.salary = salary.displayLabel
    fields.employment = employment.label
    fields.job_type = employment.labels.length ? employment.labels : null
    fields.published_at = N.parsePublishedAt(jp.datePosted)
    fields.end_date = jp.validThrough ? jp.validThrough.slice(0, 10) : null
  } catch (e) {
    // JobPostingValidationError = geen (geldige) JSON-LD. Andere errors
    // behandelen we identiek: val terug op de page-markdown als description.
    if (!(e instanceof JobPostingValidationError)) {
      console.warn(`[vacancy-detail] onverwachte parse-fout ${finalUrl}:`, e)
    }
    const md = htmlToMarkdown(html)
    descriptionText = N.stripHtml(md)
    fields.description = md || null
  }

  return { fields, descriptionText }
}

/**
 * Volledige extractie uit HTML: structurele velden + Mistral-augmentatie op de
 * description. Mistral levert working_hours/education_level/career_level/
 * categories en vult niets in als MISTRAL_API_KEY ontbreekt.
 */
export async function extractVacancyDetailFromHtml(
  html: string,
  finalUrl: string,
): Promise<VacancyDetailFields> {
  const { fields, descriptionText } = parseStructuredDetail(html, finalUrl)
  const ai =
    descriptionText.length >= 50 ? await extractFromDescription(descriptionText) : emptyMistralResult()
  fields.education_level = ai.education_level
  fields.career_level = ai.career_level
  fields.working_hours_min = ai.working_hours_min
  fields.working_hours_max = ai.working_hours_max
  fields.categories = ai.categories.join(', ') || null
  return fields
}

/** Fetch (tiered, SSRF-veilig, Playwright-fallback) + volledige extractie. */
export async function fetchAndExtractVacancyDetail(
  playwright: PlaywrightFetcher,
  url: string,
): Promise<DetailFetchOutcome> {
  try {
    const r = await tieredFetch(url, playwright)
    if (r.blocked || r.html.length < 200) return { status: 'blocked' }
    const fields = await extractVacancyDetailFromHtml(r.html, r.finalUrl)
    return { status: 'ok', fields }
  } catch (e) {
    if (e instanceof SsrfBlockedError || e instanceof FetchSizeExceededError) {
      return { status: 'blocked' }
    }
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}

/** Heeft de extractie iets bruikbaars opgeleverd? */
export function gotUsefulDetail(f: VacancyDetailFields): boolean {
  return (
    !!f.description ||
    !!f.salary ||
    !!f.employment ||
    !!f.education_level ||
    !!f.career_level ||
    f.working_hours_min != null
  )
}

/** Map naar een job_postings UPDATE-payload. */
export function detailFieldsToJobPostingUpdate(f: VacancyDetailFields): TablesUpdate<'job_postings'> {
  return {
    description: f.description,
    salary: f.salary,
    employment: f.employment,
    job_type: f.job_type,
    published_at: f.published_at,
    end_date: f.end_date,
    education_level: f.education_level,
    career_level: f.career_level,
    working_hours_min: f.working_hours_min,
    working_hours_max: f.working_hours_max,
    categories: f.categories,
  }
}

/**
 * Hang de detailvelden aan een NormalizedVacancy (voor de review-pagina, master
 * en finalize). Vult description_short als die nog leeg is, zodat de UI een
 * korte omschrijving heeft zonder de volledige description te tonen.
 */
export function mergeDetailIntoVacancy(
  v: NormalizedVacancy,
  f: VacancyDetailFields,
): NormalizedVacancy {
  return {
    ...v,
    detail: f,
    description_short:
      v.description_short ?? (f.description ? N.stripHtml(f.description).slice(0, 300) : undefined),
  }
}
