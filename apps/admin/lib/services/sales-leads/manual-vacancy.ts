import type { NormalizedVacancy, VacancyDetailFields } from './types'

// Snake_case payload zoals POST /api/vacatures die verwacht. Lege velden zijn
// undefined (niet meegestuurd).
export type VacaturePayload = {
  title: string
  company_id?: string
  new_company_name?: string
  new_company_website?: string
  new_company_city?: string
  city?: string
  zipcode?: string
  street?: string
  state?: string
  description?: string
  salary?: string
  employment?: string
  working_hours_min?: string
  working_hours_max?: string
  education_level?: string
  categories?: string
  url?: string
  end_date?: string
  platform_id?: string
  review_status: string
}

function toIntOrNull(v: string | undefined): number | null {
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

// Bouwt de lead-pool-representatie (NormalizedVacancy) uit een create-payload.
// De detail-velden voeden de chips in LeadVacanciesColumn.
export function payloadToNormalizedVacancy(p: VacaturePayload): NormalizedVacancy {
  const detail: VacancyDetailFields = {
    salary: p.salary ?? null,
    employment: p.employment ?? null,
    job_type: null,
    description: p.description ?? null,
    published_at: null,
    end_date: p.end_date ?? null,
    education_level: p.education_level ?? null,
    career_level: null,
    working_hours_min: toIntOrNull(p.working_hours_min),
    working_hours_max: toIntOrNull(p.working_hours_max),
    categories: p.categories ?? null,
  }
  const hasDetail = Object.values(detail).some((v) => v !== null)
  return {
    title: p.title.trim(),
    url: p.url || undefined,
    location: p.city || undefined,
    source: 'manual',
    detail: hasDetail ? detail : undefined,
  }
}

// Leest sales_lead_runs.manual_vacancies (jsonb). Backend POST /create slaat
// soms zonder `source` op; hier wordt 'manual' gezet. Detail wordt behouden
// wanneer aanwezig zodat chips na refresh blijven tonen.
export function normalizeManualVacancies(raw: unknown): NormalizedVacancy[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v): NormalizedVacancy[] => {
    if (!v || typeof v !== 'object') return []
    const r = v as {
      title?: unknown
      url?: unknown
      location?: unknown
      detail?: unknown
    }
    if (typeof r.title !== 'string' || !r.title.trim()) return []
    return [
      {
        title: r.title,
        url: typeof r.url === 'string' ? r.url : undefined,
        location: typeof r.location === 'string' ? r.location : undefined,
        source: 'manual',
        detail:
          r.detail && typeof r.detail === 'object'
            ? (r.detail as VacancyDetailFields)
            : undefined,
      },
    ]
  })
}
