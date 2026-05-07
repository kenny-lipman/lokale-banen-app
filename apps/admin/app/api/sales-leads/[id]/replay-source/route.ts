import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { EnrichmentOrchestratorService } from '@/lib/services/sales-leads/enrichment-orchestrator.service'

export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_SOURCES = ['kvk', 'google_maps', 'apollo', 'website'] as const
type SourceName = (typeof VALID_SOURCES)[number]

/**
 * Re-run één specifieke bron op een bestaande run zonder de andere bron-data
 * te verliezen. Gebruikt voor de "Opnieuw" knop per source-card.
 *
 * Run kan in elke status zijn behalve 'syncing'/'completed' — voor die zou
 * herrun een Pipedrive-resync vereisen wat niet binnen scope valt.
 */
async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { source?: string } | null
  if (!body || !VALID_SOURCES.includes(body.source as SourceName)) {
    return NextResponse.json(
      { error: `source moet een van ${VALID_SOURCES.join(', ')} zijn` },
      { status: 400 },
    )
  }
  const source = body.source as SourceName

  const supabase = createServiceRoleClient()
  const { data: run, error: loadErr } = await supabase
    .from('sales_lead_runs')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  if (run.status === 'syncing' || run.status === 'completed') {
    return NextResponse.json(
      { error: `Re-run niet mogelijk in status '${run.status}'` },
      { status: 400 },
    )
  }

  const svc = new EnrichmentOrchestratorService()
  waitUntil(
    svc.runSingleSource(id, source).catch((e) => {
      console.error('[orchestrator/replay-source] unhandled', id, source, e)
    }),
  )

  return NextResponse.json({ ok: true, source })
}

export const POST = withAuth(handler)
