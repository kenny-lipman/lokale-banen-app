import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { normalizeUrl } from '@/lib/utils/url'

// ─── Schemas ────────────────────────────────────────────────────────

export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export const scrapeFrequencySchema = z.enum(['daily', 'weekly', 'monthly'])
export type ReviewStatus = z.infer<typeof reviewStatusSchema>
export type ScrapeFrequency = z.infer<typeof scrapeFrequencySchema>

export const listFiltersSchema = z.object({
  kind: z.enum(['company_career_page', 'aggregator', 'all']).default('company_career_page'),
  search: z.string().trim().optional(),
  review_status: reviewStatusSchema.optional(),
  active: z.coerce.boolean().optional(),
  scrape_frequency: scrapeFrequencySchema.optional(),
  ats_type: z.string().optional(),
  company_id: z.string().uuid().optional(),
  source_run_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type ListFilters = z.infer<typeof listFiltersSchema>

export const createInputSchema = z.object({
  company_id: z.string().uuid(),
  url: z.string().min(1),
  scrape_frequency: scrapeFrequencySchema.default('weekly'),
  ats_type: z.string().nullable().optional(),
  review_status: reviewStatusSchema.default('approved'), // manual-add default = direct approved
})
export type CreateInput = z.infer<typeof createInputSchema>

export const updateInputSchema = z.object({
  scrape_frequency: scrapeFrequencySchema.optional(),
  active: z.boolean().optional(),
  ats_type: z.string().nullable().optional(),
})
export type UpdateInput = z.infer<typeof updateInputSchema>

export const rejectInputSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})
export type RejectInput = z.infer<typeof rejectInputSchema>

// ─── Types ──────────────────────────────────────────────────────────

export type CareerPageSourceRow = {
  id: string
  name: string
  kind: string
  company_id: string | null
  url: string | null
  discovery_method: string | null
  is_external_ats: boolean | null
  ats_type: string | null
  active: boolean | null
  scrape_frequency: string | null
  review_status: string
  next_scrape_at: string
  last_scraped_at: string | null
  last_scrape_status: string | null
  last_scrape_count: number | null
  consecutive_failures: number
  approved_at: string | null
  approved_by: string | null
  rejected_at: string | null
  rejected_by: string | null
  rejected_reason: string | null
  created_via: string | null
  source_run_id: string | null
  created_at: string
  updated_at: string
  company?: { id: string; name: string; website: string | null } | null
}

export type ListResult = {
  rows: CareerPageSourceRow[]
  total: number
  page: number
  pageSize: number
}

// ─── Service ────────────────────────────────────────────────────────

const COMPANY_SELECT = 'company:companies!job_sources_company_id_fkey(id,name,website)'

const ROW_SELECT = `
  id, name, kind, company_id, url, discovery_method, is_external_ats, ats_type,
  active, scrape_frequency, review_status, next_scrape_at, last_scraped_at,
  last_scrape_status, last_scrape_count, consecutive_failures,
  approved_at, approved_by, rejected_at, rejected_by, rejected_reason,
  created_via, source_run_id, created_at, updated_at,
  ${COMPANY_SELECT}
`.replace(/\s+/g, ' ')

function getClient() {
  return createServiceRoleClient()
}

export async function list(filters: ListFilters): Promise<ListResult> {
  const sb = getClient()
  const from = (filters.page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1

  let query = sb.from('job_sources').select(ROW_SELECT, { count: 'exact' })

  if (filters.kind !== 'all') {
    query = query.eq('kind', filters.kind)
  }
  if (filters.review_status) query = query.eq('review_status', filters.review_status)
  if (typeof filters.active === 'boolean') query = query.eq('active', filters.active)
  if (filters.scrape_frequency) query = query.eq('scrape_frequency', filters.scrape_frequency)
  if (filters.ats_type) query = query.eq('ats_type', filters.ats_type)
  if (filters.company_id) query = query.eq('company_id', filters.company_id)
  if (filters.source_run_id) query = query.eq('source_run_id', filters.source_run_id)
  if (filters.search) {
    // search in name + url; company-name search via OR clause op companies.name
    query = query.or(`name.ilike.%${filters.search}%,url.ilike.%${filters.search}%`)
  }

  query = query.order('updated_at', { ascending: false }).range(from, to)
  const { data, error, count } = await query
  if (error) throw new Error(`career-page-sources list: ${error.message}`)

  return {
    rows: (data ?? []) as unknown as CareerPageSourceRow[],
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  }
}

export async function getById(id: string): Promise<CareerPageSourceRow | null> {
  const sb = getClient()
  const { data, error } = await sb.from('job_sources').select(ROW_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(`career-page-sources getById: ${error.message}`)
  return (data as unknown as CareerPageSourceRow) ?? null
}

export async function create(
  input: CreateInput,
  userId: string | null,
): Promise<CareerPageSourceRow> {
  const sb = getClient()
  const canonical = normalizeUrl(input.url)
  if (!canonical) throw new Error('Ongeldige URL')

  // Lookup company-name voor de `name`-kolom
  const { data: company, error: cErr } = await sb
    .from('companies')
    .select('id, name')
    .eq('id', input.company_id)
    .single()
  if (cErr || !company) throw new Error('Company niet gevonden')

  const now = new Date().toISOString()
  const isApproved = input.review_status === 'approved'

  const { data, error } = await sb
    .from('job_sources')
    .insert({
      name: `${company.name} werkenbij`,
      kind: 'company_career_page',
      company_id: input.company_id,
      url: canonical,
      discovery_method: 'manual',
      is_external_ats: false,
      ats_type: input.ats_type ?? null,
      active: true,
      scrape_frequency: input.scrape_frequency,
      review_status: input.review_status,
      created_via: 'manual',
      created_at: now,
      updated_at: now,
      ...(isApproved ? { approved_at: now, approved_by: userId } : {}),
    })
    .select(ROW_SELECT)
    .single()
  if (error || !data) throw new Error(`career-page-sources create: ${error?.message}`)
  return data as unknown as CareerPageSourceRow
}

export async function update(id: string, input: UpdateInput): Promise<CareerPageSourceRow> {
  const sb = getClient()
  const patch: {
    updated_at: string
    scrape_frequency?: string
    active?: boolean
    ats_type?: string | null
  } = { updated_at: new Date().toISOString() }
  if (typeof input.scrape_frequency !== 'undefined') patch.scrape_frequency = input.scrape_frequency
  if (typeof input.active !== 'undefined') patch.active = input.active
  if (typeof input.ats_type !== 'undefined') patch.ats_type = input.ats_type

  const { data, error } = await sb
    .from('job_sources')
    .update(patch)
    .eq('id', id)
    .select(ROW_SELECT)
    .single()
  if (error || !data) throw new Error(`career-page-sources update: ${error?.message}`)
  return data as unknown as CareerPageSourceRow
}

export async function remove(id: string): Promise<void> {
  const sb = getClient()
  const { error } = await sb.from('job_sources').delete().eq('id', id)
  if (error) throw new Error(`career-page-sources delete: ${error.message}`)
}

export async function approve(id: string, userId: string | null): Promise<CareerPageSourceRow> {
  const sb = getClient()
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('job_sources')
    .update({
      review_status: 'approved',
      active: true,
      approved_at: now,
      approved_by: userId,
      // Reset rejection-velden voor het geval er ooit afgewezen was
      rejected_at: null,
      rejected_by: null,
      rejected_reason: null,
      updated_at: now,
    })
    .eq('id', id)
    .select(ROW_SELECT)
    .single()
  if (error || !data) throw new Error(`career-page-sources approve: ${error?.message}`)
  return data as unknown as CareerPageSourceRow
}

export async function reject(
  id: string,
  userId: string | null,
  input: RejectInput,
): Promise<CareerPageSourceRow> {
  const sb = getClient()
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('job_sources')
    .update({
      review_status: 'rejected',
      active: false,
      rejected_at: now,
      rejected_by: userId,
      rejected_reason: input.reason ?? null,
      // Reset approval-velden
      approved_at: null,
      approved_by: null,
      updated_at: now,
    })
    .eq('id', id)
    .select(ROW_SELECT)
    .single()
  if (error || !data) throw new Error(`career-page-sources reject: ${error?.message}`)
  return data as unknown as CareerPageSourceRow
}
