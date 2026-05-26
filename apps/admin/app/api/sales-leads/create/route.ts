import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'
import { EnrichmentOrchestratorService } from '@/lib/services/sales-leads/enrichment-orchestrator.service'

// Orchestrator runt fire-and-forget; de POST-response gaat eerder eruit dan
// de orchestrator klaar is. Maar Fluid Compute moet de hele runEnrichment
// kunnen voltooien — daarvoor moet de function-instance lang genoeg leven.
// 300s default is voldoende voor 4 services + Mistral × 2 (~30-60s in de praktijk).
export const maxDuration = 300
export const runtime = 'nodejs'

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com',
  'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
])

const RATE_PER_HOUR = 30
const RATE_PER_DAY = 200
const MAX_URLS_PER_BATCH = 25

function normalizeUrlAndDomain(input: string): { url: string; domain: string } | null {
  try {
    let s = input.trim()
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`
    const u = new URL(s)
    u.hash = ''
    const domain = u.hostname.replace(/^www\./, '')
    return { url: u.toString(), domain }
  } catch {
    return null
  }
}

type SkipReason =
  | 'invalid_url'
  | 'public_email_domain'
  | 'recent_completed_run'
  | 'duplicate_in_batch'

type SkippedItem = {
  input: string
  reason: SkipReason
  message: string
  recent_run_id?: string
}

async function handler(req: NextRequest, auth: AuthResult) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { input_url, input_urls, owner_config_id, manual_vacancies, scrape_vacancies, force_recreate } =
    body as {
      input_url?: string
      input_urls?: string[]
      owner_config_id?: string
      manual_vacancies?: unknown
      scrape_vacancies?: boolean
      force_recreate?: boolean
    }

  if (!owner_config_id || typeof owner_config_id !== 'string') {
    return NextResponse.json({ error: 'owner_config_id verplicht' }, { status: 400 })
  }

  // Backward-compat: single input_url wordt als 1-elementige bulk-batch behandeld
  // maar de response-shape blijft `{ run_id }` voor bestaande callers (recent_run_id
  // dedupe blijft een 409 in de single-URL flow).
  const isSingleMode = typeof input_url === 'string' && input_url.length > 0
  const isBulkMode = Array.isArray(input_urls) && input_urls.length > 0

  if (!isSingleMode && !isBulkMode) {
    return NextResponse.json({ error: 'input_url of input_urls verplicht' }, { status: 400 })
  }

  const rawUrls: string[] = isBulkMode ? (input_urls as string[]) : [input_url as string]
  if (rawUrls.length > MAX_URLS_PER_BATCH) {
    return NextResponse.json(
      { error: `Maximum ${MAX_URLS_PER_BATCH} URLs per batch (${rawUrls.length} ontvangen)` },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const userId = auth.user.id

  // Rate-limit op user-totaal binnen het uur/de dag. Telt alle runs, ook degene
  // die straks worden aangemaakt in deze batch — voorkomt N runs als rate-limit
  // bijna bereikt is.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [hourCount, dayCount] = await Promise.all([
    supabase
      .from('sales_lead_runs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .gte('created_at', oneHourAgo),
    supabase
      .from('sales_lead_runs')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', userId)
      .gte('created_at', oneDayAgo),
  ])
  const hourUsed = hourCount.count ?? 0
  const dayUsed = dayCount.count ?? 0
  const hourRoom = Math.max(0, RATE_PER_HOUR - hourUsed)
  const dayRoom = Math.max(0, RATE_PER_DAY - dayUsed)
  if (hourRoom === 0) {
    return NextResponse.json({ error: `Rate-limit: max ${RATE_PER_HOUR}/uur` }, { status: 429 })
  }
  if (dayRoom === 0) {
    return NextResponse.json({ error: `Rate-limit: max ${RATE_PER_DAY}/dag` }, { status: 429 })
  }
  const batchLimit = Math.min(hourRoom, dayRoom, rawUrls.length)

  // Light shape-check op manual_vacancies. In bulk-mode worden manual_vacancies
  // niet doorgegeven (1 lijst voor N URLs geeft slechte semantiek); we behouden
  // ze alleen in single-mode voor backward-compat.
  const cleanedVacancies: Array<{ title: string; url?: string; location?: string }> =
    isSingleMode && Array.isArray(manual_vacancies)
      ? (manual_vacancies as unknown[]).filter(
          (v): v is { title: string; url?: string; location?: string } =>
            typeof v === 'object' && v !== null && typeof (v as { title?: unknown }).title === 'string',
        )
      : []

  const runIds: string[] = []
  const skipped: SkippedItem[] = []
  const seenDomains = new Set<string>()

  for (let i = 0; i < rawUrls.length; i++) {
    const raw = rawUrls[i]
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      skipped.push({ input: String(raw ?? ''), reason: 'invalid_url', message: 'Lege URL' })
      continue
    }
    const norm = normalizeUrlAndDomain(raw)
    if (!norm) {
      skipped.push({ input: raw, reason: 'invalid_url', message: 'Niet-parseerbare URL' })
      continue
    }
    if (PUBLIC_EMAIL_DOMAINS.has(norm.domain)) {
      skipped.push({
        input: raw,
        reason: 'public_email_domain',
        message: `Publieke email-domein "${norm.domain}" niet toegestaan`,
      })
      continue
    }
    if (seenDomains.has(norm.domain)) {
      skipped.push({ input: raw, reason: 'duplicate_in_batch', message: `Domein "${norm.domain}" zit dubbel in batch` })
      continue
    }
    seenDomains.add(norm.domain)

    // Duplicate-binnen-24u check (skip bij force). In bulk-mode altijd skippen
    // ipv 409 — sales wil de hele batch laten doorlopen.
    if (!force_recreate) {
      const { data: recent } = await supabase
        .from('sales_lead_runs')
        .select('id')
        .eq('input_domain', norm.domain)
        .eq('status', 'completed')
        .gte('created_at', oneDayAgo)
        .limit(1)
        .maybeSingle()
      if (recent) {
        if (isSingleMode) {
          // Behoud bestaande 409-contract voor single-mode callers.
          return NextResponse.json(
            { error: 'Recent completed run bestaat al', recent_run_id: recent.id },
            { status: 409 },
          )
        }
        skipped.push({
          input: raw,
          reason: 'recent_completed_run',
          message: `Recent verrijkt (binnen 24u)`,
          recent_run_id: recent.id,
        })
        continue
      }
    }

    if (runIds.length >= batchLimit) {
      skipped.push({
        input: raw,
        reason: 'recent_completed_run',
        message: `Overgeslagen — rate-limit (${RATE_PER_HOUR}/uur of ${RATE_PER_DAY}/dag)`,
      })
      continue
    }

    const { data: inserted, error } = await supabase
      .from('sales_lead_runs')
      .insert({
        created_by: userId,
        input_url: norm.url,
        input_domain: norm.domain,
        owner_config_id,
        manual_vacancies: cleanedVacancies as unknown as Json,
        scrape_vacancies: scrape_vacancies !== false,
        status: 'enriching',
      })
      .select('id')
      .single()
    if (error || !inserted) {
      if (isSingleMode) {
        return NextResponse.json(
          { error: `Insert faalde: ${error?.message ?? 'onbekend'}` },
          { status: 500 },
        )
      }
      skipped.push({
        input: raw,
        reason: 'invalid_url',
        message: `Insert faalde: ${error?.message ?? 'onbekend'}`,
      })
      continue
    }
    runIds.push(inserted.id)

    // Background orchestrator via waitUntil — vertelt Vercel runtime de function
    // alive te houden tot deze promise resolved. Bij bulk N URLs: alle waitUntil-
    // promises lopen parallel binnen dezelfde function-instance. Apollo/Mistral
    // rate-limits hebben hun eigen retry; we starten dus ongebreideld.
    const svc = new EnrichmentOrchestratorService()
    waitUntil(
      svc.runEnrichment(inserted.id).catch((e) => {
        console.error('[orchestrator] unhandled', inserted.id, e)
      }),
    )
  }

  if (isSingleMode) {
    if (runIds.length === 0) {
      const reason = skipped[0]?.message ?? 'Aanmaken mislukt'
      return NextResponse.json({ error: reason }, { status: 400 })
    }
    return NextResponse.json({ run_id: runIds[0] }, { status: 201 })
  }

  return NextResponse.json(
    {
      run_ids: runIds,
      skipped,
      requested: rawUrls.length,
    },
    { status: 201 },
  )
}

export const POST = withAuth(handler)
