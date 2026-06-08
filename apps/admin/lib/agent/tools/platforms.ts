import type { ToolSet } from 'ai'
import { z } from 'zod'
import {
  failedRequiredKeys,
  validatePublication
} from '@/lib/services/platform-publication.service'
import { runAuditedTool } from './shared'
import type { AgentToolContext } from '../types'
import type { AgentToolOutput } from './types'

const uuidSchema = z.string().uuid()

const searchPlatformsInputSchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  readiness: z.enum(['ready', 'blocked']).optional(),
  includeReadiness: z.boolean().optional(),
  page: z.number().int().min(1).max(1000).optional(),
  pageSize: z.number().int().min(1).max(25).optional()
})

const platformIdInputSchema = z.object({
  platformId: uuidSchema
})

type SearchPlatformsInput = z.infer<typeof searchPlatformsInputSchema>
type PlatformIdInput = z.infer<typeof platformIdInputSchema>
type SupabaseLike = any

function readinessSummary(validation: Awaited<ReturnType<typeof validatePublication>>) {
  if (!validation) return null

  const failedKeys = failedRequiredKeys(validation)
  return {
    allRequiredPassed: validation.all_required_passed,
    failedRequiredKeys: failedKeys,
    approvedVacancyCount: validation.approved_vacancy_count,
    checks: validation.checks.map((check) => ({
      key: check.key,
      label: check.label,
      required: check.required,
      passed: check.passed,
      value: check.value ?? null
    })),
    domain: validation.domain,
    previewDomain: validation.preview_domain,
    isPublic: validation.is_public,
    publishedAt: validation.published_at
  }
}

async function getApprovedCounts(platformIds: string[], supabase: SupabaseLike): Promise<Record<string, number>> {
  const entries = await Promise.all(platformIds.map(async (platformId) => {
    const { count, error } = await supabase
      .from('job_postings')
      .select('id', { count: 'exact', head: true })
      .eq('platform_id', platformId)
      .eq('review_status', 'approved')

    if (error) {
      throw new Error(error.message || `Approved vacature-aantal ophalen mislukt voor platform ${platformId}`)
    }

    return [platformId, count ?? 0] as const
  }))

  return Object.fromEntries(entries)
}

function sanitizeSearchPattern(search: string): string {
  return `%${search.replace(/[%,]/g, ' ').trim()}%`
}

async function searchPlatforms(
  input: SearchPlatformsInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('platforms')
    .select(`
      id, regio_platform, central_place, central_postcode, domain,
      preview_domain, is_public, is_active, tier, logo_url, primary_color,
      hero_title, hero_subtitle, seo_description, published_at, updated_at
    `, { count: 'exact' })
    .order('regio_platform', { ascending: true })
    .range(from, to)

  if (input.search) {
    const pattern = sanitizeSearchPattern(input.search)
    query = query.or(`regio_platform.ilike.${pattern},central_place.ilike.${pattern},domain.ilike.${pattern},preview_domain.ilike.${pattern}`)
  }

  if (typeof input.isPublic === 'boolean') {
    query = query.eq('is_public', input.isPublic)
  }

  if (typeof input.isActive === 'boolean') {
    query = query.eq('is_active', input.isActive)
  }

  const { data, error, count } = await query

  if (error) {
    throw new Error(error.message || 'Platforms zoeken mislukt')
  }

  const platforms = data ?? []
  const approvedCounts = await getApprovedCounts(platforms.map((platform: any) => platform.id), supabase)
  const shouldIncludeReadiness = input.includeReadiness || Boolean(input.readiness)
  const readinessByPlatform = shouldIncludeReadiness
    ? Object.fromEntries(await Promise.all(platforms.map(async (platform: any) => [
        platform.id,
        readinessSummary(await validatePublication(supabase, platform.id))
      ] as const)))
    : {}

  const items = platforms
    .map((platform: any) => ({
      id: platform.id,
      regioPlatform: platform.regio_platform,
      centralPlace: platform.central_place,
      centralPostcode: platform.central_postcode,
      domain: platform.domain,
      previewDomain: platform.preview_domain,
      isPublic: platform.is_public ?? false,
      isActive: platform.is_active ?? false,
      tier: platform.tier,
      logoUrl: platform.logo_url,
      primaryColor: platform.primary_color,
      heroTitle: platform.hero_title,
      heroSubtitle: platform.hero_subtitle,
      seoDescription: platform.seo_description,
      publishedAt: platform.published_at,
      updatedAt: platform.updated_at,
      approvedVacancyCount: approvedCounts[platform.id] ?? 0,
      readiness: readinessByPlatform[platform.id] ?? null
    }))
    .filter((platform: any) => {
      if (!input.readiness) return true
      const isReady = platform.readiness?.allRequiredPassed === true
      return input.readiness === 'ready' ? isReady : !isReady
    })

  const warnings = [
    input.readiness ? 'Readiness-resultaten zijn gefilterd binnen deze pagina. Gebruik een concrete platform-check voor definitieve go-live readiness.' : null,
    items.length === 0 ? 'Geen platforms gevonden op deze pagina voor deze filters.' : null
  ].filter((warning): warning is string => Boolean(warning))

  return {
    summary: input.readiness
      ? `${items.length} platforms op deze pagina matchen readiness "${input.readiness}"${typeof count === 'number' ? ` binnen ${count} basisresultaten` : ''}.`
      : `${items.length} platforms gevonden${typeof count === 'number' ? ` van ${count}` : ''}.`,
    data: {
      items,
      page,
      pageSize,
      totalCount: count ?? null,
      totalPages: typeof count === 'number' ? Math.ceil(count / pageSize) : null
    },
    warnings,
    nextActions: items.length > 0
      ? ['Gebruik get_platform_readiness of explain_platform_blockers voor detailchecks.']
      : [input.readiness ? 'Controleer de volgende pagina of gebruik get_platform_readiness met een specifiek platform.' : 'Verruim de filters of zoek op platformnaam, plaats of domein.']
  }
}

async function getPlatformReadiness(
  input: PlatformIdInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const validation = await validatePublication(supabase, input.platformId)

  if (!validation) {
    return {
      summary: 'Platform niet gevonden.',
      data: { platformId: input.platformId },
      warnings: ['Controleer het platform-ID.']
    }
  }

  const readiness = readinessSummary(validation)

  return {
    summary: validation.all_required_passed
      ? 'Platform voldoet aan alle vereiste go-live checks.'
      : `Platform mist ${failedRequiredKeys(validation).length} vereiste go-live checks.`,
    data: readiness,
    warnings: validation.checks
      .filter((check) => check.required && !check.passed)
      .map((check) => `${check.label} ontbreekt of is onvoldoende.`),
    nextActions: validation.all_required_passed
      ? ['Geen write-actie uitgevoerd. Een admin kan het platform handmatig live zetten.']
      : ['Vul ontbrekende platformvelden aan en controleer approved vacature-aantallen opnieuw.']
  }
}

async function explainPlatformBlockers(
  input: PlatformIdInput,
  supabase: SupabaseLike
): Promise<AgentToolOutput> {
  const validation = await validatePublication(supabase, input.platformId)

  if (!validation) {
    return {
      summary: 'Platform niet gevonden.',
      data: { platformId: input.platformId },
      warnings: ['Controleer het platform-ID.']
    }
  }

  const requiredFailures = validation.checks.filter((check) => check.required && !check.passed)
  const optionalFailures = validation.checks.filter((check) => !check.required && !check.passed)

  return {
    summary: requiredFailures.length === 0
      ? 'Geen vereiste platformblockers gevonden.'
      : `${requiredFailures.length} vereiste platformblockers gevonden.`,
    data: {
      platformId: validation.platform_id,
      allRequiredPassed: validation.all_required_passed,
      requiredFailures,
      optionalFailures,
      approvedVacancyCount: validation.approved_vacancy_count,
      domain: validation.domain,
      previewDomain: validation.preview_domain,
      isPublic: validation.is_public
    },
    warnings: requiredFailures.map((check) => `${check.label}: niet voldaan.`),
    nextActions: requiredFailures.length > 0
      ? requiredFailures.map((check) => `Los check "${check.label}" op.`)
      : ['Geen write-actie uitgevoerd. Het platform kan door een admin handmatig live gezet worden.']
  }
}

export function createPlatformTools(context: AgentToolContext): ToolSet {
  return {
    search_platforms: {
      description: 'Zoek regionale platforms en optioneel hun readiness. Read-only.',
      inputSchema: searchPlatformsInputSchema,
      execute: (input: SearchPlatformsInput) => runAuditedTool({
        context,
        toolName: 'search_platforms',
        input,
        run: (supabase) => searchPlatforms(input, supabase)
      })
    },
    get_platform_readiness: {
      description: 'Haal go-live readiness op voor een platform via validatePublication. Read-only.',
      inputSchema: platformIdInputSchema,
      execute: (input: PlatformIdInput) => runAuditedTool({
        context,
        toolName: 'get_platform_readiness',
        input,
        run: (supabase) => getPlatformReadiness(input, supabase)
      })
    },
    explain_platform_blockers: {
      description: 'Leg uit welke go-live checks een platform blokkeren. Read-only.',
      inputSchema: platformIdInputSchema,
      execute: (input: PlatformIdInput) => runAuditedTool({
        context,
        toolName: 'explain_platform_blockers',
        input,
        run: (supabase) => explainPlatformBlockers(input, supabase)
      })
    }
  } satisfies ToolSet
}
