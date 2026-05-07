import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { EnrichmentOrchestratorService } from '@/lib/services/sales-leads/enrichment-orchestrator.service'
import type { Json } from '@/lib/supabase'
import type { AuditLogEntry } from '@/lib/services/sales-leads/types'

export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const REPLAYABLE_STATUSES = new Set(['failed', 'duplicate'])

/**
 * Reset run-state en re-trigger orchestrator op zelfde run_id. Behoudt input
 * (url, owner_config, manual_vacancies, scrape_vacancies) en audit_log
 * (append-only, krijgt 'replay'-entry erbij).
 *
 * Allow alleen op terminale failure-states. `review`/`completed` requires
 * expliciet nieuw run aanmaken (anders verlies je user-edits).
 */
async function handler(_req: NextRequest, auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()

  const { data: run, error: loadErr } = await supabase
    .from('sales_lead_runs')
    .select('id,status,audit_log')
    .eq('id', id)
    .maybeSingle()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  if (!REPLAYABLE_STATUSES.has(run.status)) {
    return NextResponse.json(
      {
        error: `Replay alleen toegestaan voor failed/duplicate runs (huidige: ${run.status}). Maak een nieuwe run via /nieuw.`,
      },
      { status: 400 },
    )
  }

  const replayEntry: AuditLogEntry = {
    ts: new Date().toISOString(),
    source: 'mistral', // hergebruik bestaande source-enum; replay is geen specifieke source
    endpoint: 'replay',
    duration_ms: 0,
    status: 'ok',
  }
  const newAuditLog = [...((run.audit_log ?? []) as AuditLogEntry[]), replayEntry]

  const { error: resetErr } = await supabase
    .from('sales_lead_runs')
    .update({
      status: 'enriching',
      enrichments: {} as unknown as Json,
      master_record: null,
      selected_contacts: null,
      error: null,
      pipedrive_org_id: null,
      pipedrive_deal_id: null,
      audit_log: newAuditLog as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (resetErr) return NextResponse.json({ error: resetErr.message }, { status: 500 })

  // Trigger orchestrator via waitUntil — zelfde pattern als /create.
  const svc = new EnrichmentOrchestratorService()
  waitUntil(
    svc.runEnrichment(id).catch((e) => {
      console.error('[orchestrator/replay] unhandled', id, e)
    }),
  )

  return NextResponse.json({ ok: true, run_id: id, replayed_by: auth.user.email })
}

export const POST = withAuth(handler)
