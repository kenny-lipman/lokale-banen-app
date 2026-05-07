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

async function handler(req: NextRequest, auth: AuthResult) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { input_url, owner_config_id, manual_vacancies, scrape_vacancies, force_recreate } =
    body as {
      input_url?: string
      owner_config_id?: string
      manual_vacancies?: unknown
      scrape_vacancies?: boolean
      force_recreate?: boolean
    }

  if (!input_url || typeof input_url !== 'string') {
    return NextResponse.json({ error: 'input_url verplicht' }, { status: 400 })
  }
  if (!owner_config_id || typeof owner_config_id !== 'string') {
    return NextResponse.json({ error: 'owner_config_id verplicht' }, { status: 400 })
  }

  const norm = normalizeUrlAndDomain(input_url)
  if (!norm) return NextResponse.json({ error: 'Ongeldige URL' }, { status: 400 })

  if (PUBLIC_EMAIL_DOMAINS.has(norm.domain)) {
    return NextResponse.json(
      { error: `Publieke email-domein "${norm.domain}" niet toegestaan` },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const userId = auth.user.id

  // Rate-limit
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
  if ((hourCount.count ?? 0) >= RATE_PER_HOUR) {
    return NextResponse.json({ error: `Rate-limit: max ${RATE_PER_HOUR}/uur` }, { status: 429 })
  }
  if ((dayCount.count ?? 0) >= RATE_PER_DAY) {
    return NextResponse.json({ error: `Rate-limit: max ${RATE_PER_DAY}/dag` }, { status: 429 })
  }

  // Duplicate-binnen-24u check (skip bij force)
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
      return NextResponse.json(
        { error: 'Recent completed run bestaat al', recent_run_id: recent.id },
        { status: 409 },
      )
    }
  }

  // Light shape-check op manual_vacancies: alleen objecten met een title
  // door (verdere normalisatie gebeurt in fase 5 bij Pipedrive sync).
  const cleanedVacancies: Array<{ title: string; url?: string; location?: string }> = Array.isArray(manual_vacancies)
    ? (manual_vacancies as unknown[]).filter(
        (v): v is { title: string; url?: string; location?: string } =>
          typeof v === 'object' && v !== null && typeof (v as { title?: unknown }).title === 'string',
      )
    : []

  // Insert run met status='enriching'
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
    return NextResponse.json(
      { error: `Insert faalde: ${error?.message ?? 'onbekend'}` },
      { status: 500 },
    )
  }

  // Background orchestrator via waitUntil — vertelt Vercel runtime de function
  // alive te houden tot deze promise resolved. Zonder waitUntil (gewone `void`)
  // wordt de instance soms direct na de response gekild, vooral bij zwaardere
  // bundles met Playwright/@sparticuz/chromium.
  const svc = new EnrichmentOrchestratorService()
  waitUntil(
    svc.runEnrichment(inserted.id).catch((e) => {
      console.error('[orchestrator] unhandled', inserted.id, e)
    }),
  )

  return NextResponse.json({ run_id: inserted.id }, { status: 201 })
}

export const POST = withAuth(handler)
