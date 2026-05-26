import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { EnrichmentOrchestratorService } from '@/lib/services/sales-leads/enrichment-orchestrator.service'

/**
 * Per-run enrichment worker. Bulk-create dispatcht 1 worker per URL via HTTP
 * fan-out (zie `app/api/sales-leads/create/route.ts`). Elke worker draait in
 * z'n eigen Vercel function-instance → eigen /tmp → geen race op de Chromium-
 * binary van `@sparticuz/chromium`.
 *
 * Auth: `withCronAuth` (Bearer CRON_SECRET) — uitsluitend voor server-to-server
 * dispatch vanuit andere routes binnen dit deployment.
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
