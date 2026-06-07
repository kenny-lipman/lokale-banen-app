// @auth SECRET
import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { EnrichmentOrchestratorService } from '@/lib/services/sales-leads/enrichment-orchestrator.service'

/**
 * Per-run enrichment worker. Bulk-create dispatcht 1 worker per URL via HTTP
 * fan-out (zie `app/api/sales-leads/create/route.ts`). Elke worker draait in
 * z'n eigen Vercel function-instance → eigen /tmp → geen race op de Chromium-
 * binary van `@sparticuz/chromium`.
 *
 * Auth: `withCronAuth` (Bearer CRON_SECRET) — uitsluitend voor server-to-server
 * dispatch vanuit andere routes binnen dit deployment.
 *
 * Idempotency: atomic CAS-claim op `sales_lead_runs.worker_claimed_at` voorkomt
 * dat twee parallelle dispatches (network-retry, dubbel-klik op /replay) dezelfde
 * run dubbel verwerken. Eerste worker claimt door timestamp te zetten; tweede
 * worker krijgt een lege rowset terug en exit met `skipped='already_claimed'`.
 * /replay reset deze kolom expliciet zodat een herstart wel mogelijk blijft.
 */
export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

async function handler(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'run id ontbreekt' }, { status: 400 })
  }

  const start = Date.now()
  const supabase = createServiceRoleClient()

  // Atomic claim: UPDATE ... WHERE worker_claimed_at IS NULL RETURNING garandeert
  // dat slechts één concurrent worker de rij claimt. Postgres serialiseert UPDATEs
  // op dezelfde rij; de tweede ziet worker_claimed_at als niet-NULL en matched niet.
  const { data: claimed, error: claimErr } = await supabase
    .from('sales_lead_runs')
    .update({ worker_claimed_at: new Date().toISOString() })
    .eq('id', id)
    .is('worker_claimed_at', null)
    // Een gearchiveerde run niet (meer) verrijken: scheelt KvK/Apollo-credits.
    .is('archived_at', null)
    .select('id')
    .maybeSingle()

  if (claimErr) {
    console.error('[enrich-worker] claim faalde', id, claimErr.message)
    return NextResponse.json({ ok: false, runId: id, error: claimErr.message }, { status: 500 })
  }
  if (!claimed) {
    // Andere worker draait al, of run bestaat niet meer. UI kijkt naar run-status.
    return NextResponse.json({ ok: true, runId: id, skipped: 'already_claimed' })
  }

  try {
    const svc = new EnrichmentOrchestratorService()
    await svc.runEnrichment(id)
    return NextResponse.json({ ok: true, runId: id, duration_ms: Date.now() - start })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[enrich-worker] failed', id, message)
    // Status van de run is door de orchestrator zelf op 'failed' gezet (zie
    // EnrichmentOrchestratorService.runEnrichment catch-block). 500 hier is
    // signalering voor de dispatcher; de UI leest run-status uit de DB.
    return NextResponse.json(
      { ok: false, runId: id, error: message, duration_ms: Date.now() - start },
      { status: 500 },
    )
  }
}

export const POST = withCronAuth(handler)
