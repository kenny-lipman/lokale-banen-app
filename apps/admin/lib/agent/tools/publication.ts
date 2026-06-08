import type { ToolSet } from 'ai'
import { z } from 'zod'
import { validateJobPostingsForPush } from '@/lib/services/lokalebanen-push.service'
import { validatePublication, failedRequiredKeys } from '@/lib/services/platform-publication.service'
import { runAuditedTool } from './shared'
import type { AgentToolContext } from '../types'
import type { AgentToolOutput } from './types'

const uuidSchema = z.string().uuid()

const searchJobPostingsInputSchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  reviewStatus: z.string().trim().min(1).max(50).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  platformIds: z.array(uuidSchema).max(20).optional(),
  sourceIds: z.array(uuidSchema).max(20).optional(),
  employment: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  educationLevel: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  careerLevel: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  hoursMin: z.number().min(0).max(80).optional(),
  hoursMax: z.number().min(0).max(80).optional(),
  archived: z.enum(['active', 'archived', 'all']).optional(),
  page: z.number().int().min(1).max(1000).optional(),
  pageSize: z.number().int().min(1).max(25).optional()
})

const jobPostingIdInputSchema = z.object({
  jobPostingId: uuidSchema
})

const jobPostingIdsInputSchema = z.object({
  jobPostingIds: z.array(uuidSchema).min(1).max(50)
})

const suggestPublicationBatchInputSchema = z.object({
  platformId: uuidSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(25).optional()
})

type SearchJobPostingsInput = z.infer<typeof searchJobPostingsInputSchema>
type JobPostingIdInput = z.infer<typeof jobPostingIdInputSchema>
type JobPostingIdsInput = z.infer<typeof jobPostingIdsInputSchema>
type SuggestPublicationBatchInput = z.infer<typeof suggestPublicationBatchInputSchema>

type SupabaseLike = any

function normalizeJobPostingRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    companyId: row.company_id,
    companyName: row.company_name,
    city: row.city,
    location: row.location,
    platformId: row.platform_id,
    platformName: row.platform_regio_platform,
    sourceId: row.source_id,
    sourceName: row.source_name,
    status: row.status,
    reviewStatus: row.review_status,
    archivedAt: row.archived_at,
    lokalebanenPushedAt: row.lokalebanen_pushed_at,
    salary: row.salary,
    employment: row.employment,
    educationLevel: row.education_level,
    workingHoursMin: row.working_hours_min,
    workingHoursMax: row.working_hours_max,
    createdAt: row.created_at,
    url: row.url
  }
}

async function searchJobPostings(
  input: SearchJobPostingsInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const { data, error } = await supabase.rpc('search_job_postings', {
    search_term: input.search ?? null,
    status_filter: input.status ?? null,
    review_status_filter: input.reviewStatus ?? null,
    source_filter: input.sourceIds && input.sourceIds.length > 0 ? input.sourceIds : null,
    platform_filter: input.platformIds && input.platformIds.length > 0 ? input.platformIds : null,
    page_number: page,
    page_size: pageSize,
    date_from: input.dateFrom ?? null,
    date_to: input.dateTo ?? null,
    employment_filter: input.employment && input.employment.length > 0 ? input.employment : null,
    education_level_filter: input.educationLevel && input.educationLevel.length > 0 ? input.educationLevel : null,
    career_level_filter: input.careerLevel && input.careerLevel.length > 0 ? input.careerLevel : null,
    salary_min: null,
    salary_max: null,
    hours_min: input.hoursMin ?? null,
    hours_max: input.hoursMax ?? null,
    archived_filter: input.archived ?? 'active'
  })

  if (error) {
    throw new Error(error.message || 'Vacatures zoeken mislukt')
  }

  const rows = data ?? []
  const totalCount = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0
  const isCapped = rows.length > 0 ? Boolean(rows[0].is_capped) : false
  const items = rows.map(normalizeJobPostingRow)
  const warnings = [
    isCapped ? 'Het totaal is afgekapt op 10.000+ resultaten.' : null,
    items.length === 0 ? 'Geen vacatures gevonden voor deze filters.' : null
  ].filter((warning): warning is string => Boolean(warning))

  return {
    summary: `${items.length} vacatures gevonden van ${isCapped ? '10.000+' : totalCount}.`,
    data: {
      items,
      page,
      pageSize,
      totalCount,
      isCapped,
      totalPages: Math.ceil(totalCount / pageSize)
    },
    warnings,
    nextActions: items.length > 0
      ? ['Gebruik get_job_publication_context voor details of validate_lokalebanen_push voor push-readiness.']
      : ['Verruim de filters of zoek op bedrijfsnaam, functietitel of plaats.']
  }
}

async function fetchJobPublicationContext(jobPostingId: string, supabase: SupabaseLike) {
  const { data: job, error } = await supabase
    .from('job_postings')
    .select(`
      id, title, description, content_md, city, zipcode, street, employment,
      education_level, categories, working_hours_min, working_hours_max,
      salary, status, review_status, archived_at, platform_id, lokalebanen_id,
      lokalebanen_pushed_at, company_id, url, created_at,
      companies ( id, name, city, postal_code, street_address, lokalebanen_id ),
      platforms ( id, regio_platform, domain, preview_domain, is_public )
    `)
    .eq('id', jobPostingId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Vacature ophalen mislukt')
  }

  return job
}

function asRelationObject<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizePushValidation(
  validation: Awaited<ReturnType<typeof validateJobPostingsForPush>>,
  requestedIds: string[]
) {
  const returnedIds = new Set([
    ...validation.valid.map((item) => item.jobPostingId),
    ...validation.invalid.map((item) => item.jobPostingId)
  ])
  const missingInvalid = requestedIds
    .filter((id) => !returnedIds.has(id))
    .map((id) => ({
      jobPostingId: id,
      title: id,
      reason: 'Vacature niet gevonden of niet beschikbaar voor validatie.'
    }))

  return {
    valid: validation.valid,
    invalid: [...validation.invalid, ...missingInvalid]
  }
}

async function getJobPublicationContext(
  input: JobPostingIdInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const job = await fetchJobPublicationContext(input.jobPostingId, supabase)
  if (!job) {
    return {
      summary: 'Vacature niet gevonden.',
      data: { jobPostingId: input.jobPostingId },
      warnings: ['Controleer het vacature-ID.']
    }
  }

  const validation = await validateJobPostingsForPush([input.jobPostingId], supabase)
  const platform = asRelationObject(job.platforms)
  const company = asRelationObject(job.companies)
  const platformReadiness = job.platform_id
    ? await validatePublication(supabase, job.platform_id)
    : null

  return {
    summary: `${job.title} bij ${company?.name ?? 'onbekend bedrijf'} is ${validation.valid.length > 0 ? 'klaar' : 'niet klaar'} voor Lokale Banen push-validatie.`,
    data: {
      job: {
        id: job.id,
        title: job.title,
        companyId: job.company_id,
        companyName: company?.name ?? null,
        city: job.city,
        platformId: job.platform_id,
        platformName: platform?.regio_platform ?? null,
        status: job.status,
        reviewStatus: job.review_status,
        archivedAt: job.archived_at,
        lokalebanenId: job.lokalebanen_id,
        lokalebanenPushedAt: job.lokalebanen_pushed_at,
        hasDescription: Boolean(job.description),
        hasContentMd: Boolean(job.content_md),
        url: job.url,
        createdAt: job.created_at
      },
      validation,
      platformReadiness: platformReadiness
        ? {
            allRequiredPassed: platformReadiness.all_required_passed,
            approvedVacancyCount: platformReadiness.approved_vacancy_count,
            failedRequiredKeys: failedRequiredKeys(platformReadiness),
            domain: platformReadiness.domain,
            previewDomain: platformReadiness.preview_domain,
            isPublic: platformReadiness.is_public
          }
        : null
    },
    warnings: validation.invalid.map((item) => item.reason),
    nextActions: validation.valid.length > 0
      ? ['Gebruik validate_lokalebanen_push voor een batch-check voordat iemand handmatig pusht.']
      : ['Los de genoemde blockers op voordat iemand handmatig publiceert of pusht.']
  }
}

async function explainJobBlockers(
  input: JobPostingIdsInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const validation = normalizePushValidation(
    await validateJobPostingsForPush(input.jobPostingIds, supabase),
    input.jobPostingIds
  )
  const blockersByReason = validation.invalid.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1
    return acc
  }, {})

  return {
    summary: `${validation.valid.length} vacatures klaar, ${validation.invalid.length} vacatures geblokkeerd.`,
    data: {
      valid: validation.valid,
      invalid: validation.invalid,
      blockersByReason
    },
    warnings: validation.invalid.map((item) => `${item.title}: ${item.reason}`),
    nextActions: validation.invalid.length > 0
      ? ['Pak eerst ontbrekende platform-mapping, bedrijfs-email of stad aan.', 'Voer validate_lokalebanen_push opnieuw uit na correcties.']
      : ['De opgegeven vacatures zijn klaar voor handmatige push-validatie.']
  }
}

async function suggestPublicationBatch(
  input: SuggestPublicationBatchInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const limit = input.limit ?? 10
  const searchResult = await searchJobPostings({
    search: input.search,
    platformIds: input.platformId ? [input.platformId] : undefined,
    reviewStatus: 'approved',
    archived: 'active',
    page: 1,
    pageSize: Math.min(25, Math.max(limit * 3, limit))
  }, supabase)

  const items = (searchResult.data as any).items as Array<{ id: string }>
  const ids = items.map((item) => item.id)
  const validation = ids.length > 0
    ? await validateJobPostingsForPush(ids, supabase)
    : { valid: [], invalid: [] }
  const selected = validation.valid.slice(0, limit)

  return {
    summary: `${selected.length} geschikte vacatures voorgesteld voor een handmatige publicatiebatch.`,
    data: {
      candidates: selected,
      rejected: validation.invalid,
      requestedLimit: limit,
      scannedCount: ids.length,
      filters: {
        platformId: input.platformId ?? null,
        search: input.search ?? null,
        reviewStatus: 'approved',
        archived: 'active'
      }
    },
    warnings: [
      selected.length < limit ? `Er zijn maar ${selected.length} geschikte vacatures gevonden binnen de scan.` : null,
      ...validation.invalid.map((item) => `${item.title}: ${item.reason}`)
    ].filter((warning): warning is string => Boolean(warning)),
    nextActions: selected.length > 0
      ? ['Laat een admin de selectie controleren voordat er handmatig wordt gepusht.']
      : ['Verruim de zoekfilters of los blockers op bij approved vacatures.']
  }
}

async function validateLokalebanenPush(
  input: JobPostingIdsInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const validation = normalizePushValidation(
    await validateJobPostingsForPush(input.jobPostingIds, supabase),
    input.jobPostingIds
  )

  return {
    summary: `${validation.valid.length} van ${input.jobPostingIds.length} vacatures zijn push-ready.`,
    data: {
      total: input.jobPostingIds.length,
      valid: validation.valid,
      invalid: validation.invalid
    },
    warnings: validation.invalid.map((item) => `${item.title}: ${item.reason}`),
    nextActions: validation.invalid.length > 0
      ? ['Los de invalid redenen op en valideer opnieuw voordat iemand handmatig pusht.']
      : ['Geen write-actie uitgevoerd. De batch kan door een admin handmatig worden gepusht.']
  }
}

export function createPublicationTools(context: AgentToolContext): ToolSet {
  return {
    search_job_postings: {
      description: 'Zoek vacatures met filters. Read-only, gebruikt de search_job_postings RPC.',
      inputSchema: searchJobPostingsInputSchema,
      execute: (input: SearchJobPostingsInput) => runAuditedTool({
        context,
        toolName: 'search_job_postings',
        input,
        run: (supabase) => searchJobPostings(input, supabase)
      })
    },
    get_job_publication_context: {
      description: 'Haal publicatiecontext en validatie op voor een vacature. Read-only.',
      inputSchema: jobPostingIdInputSchema,
      execute: (input: JobPostingIdInput) => runAuditedTool({
        context,
        toolName: 'get_job_publication_context',
        input,
        run: (supabase) => getJobPublicationContext(input, supabase)
      })
    },
    explain_job_blockers: {
      description: 'Leg uit waarom vacatures niet klaar zijn voor Lokale Banen push. Read-only.',
      inputSchema: jobPostingIdsInputSchema,
      execute: (input: JobPostingIdsInput) => runAuditedTool({
        context,
        toolName: 'explain_job_blockers',
        input,
        run: (supabase) => explainJobBlockers(input, supabase)
      })
    },
    suggest_publication_batch: {
      description: 'Stel een batch approved vacatures voor die push-ready lijken. Read-only.',
      inputSchema: suggestPublicationBatchInputSchema,
      execute: (input: SuggestPublicationBatchInput) => runAuditedTool({
        context,
        toolName: 'suggest_publication_batch',
        input,
        run: (supabase) => suggestPublicationBatch(input, supabase)
      })
    },
    validate_lokalebanen_push: {
      description: 'Valideer of vacatures klaar zijn voor Lokale Banen push. Voert geen push uit.',
      inputSchema: jobPostingIdsInputSchema,
      execute: (input: JobPostingIdsInput) => runAuditedTool({
        context,
        toolName: 'validate_lokalebanen_push',
        input,
        run: (supabase) => validateLokalebanenPush(input, supabase)
      })
    }
  } satisfies ToolSet
}
