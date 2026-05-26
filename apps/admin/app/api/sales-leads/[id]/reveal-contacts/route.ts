import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { EnrichmentOrchestratorService } from '@/lib/services/sales-leads/enrichment-orchestrator.service'

export const maxDuration = 60
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const MAX_REVEAL_PER_CALL = 25

/**
 * Reveal Apollo cold contacts via `/people/bulk_match`. Verbruikt 1 credit per
 * gerevealde persoon. Synchronously omdat user op het resultaat wacht in de UI;
 * Apollo bulk_match is snel (~1-2s per chunk van 10).
 */
async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { apollo_ids?: unknown } | null

  if (!body || !Array.isArray(body.apollo_ids)) {
    return NextResponse.json({ error: 'apollo_ids moet een array zijn' }, { status: 400 })
  }
  const apolloIds = body.apollo_ids.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (apolloIds.length === 0) {
    return NextResponse.json({ error: 'apollo_ids mag niet leeg zijn' }, { status: 400 })
  }
  if (apolloIds.length > MAX_REVEAL_PER_CALL) {
    return NextResponse.json(
      { error: `Maximaal ${MAX_REVEAL_PER_CALL} contacten per call` },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data: run, error: loadErr } = await supabase
    .from('sales_lead_runs')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  if (run.status === 'syncing' || run.status === 'completed' || run.status === 'duplicate') {
    return NextResponse.json(
      {
        error: run.status === 'duplicate'
          ? 'Run is gemarkeerd als duplicaat - Apollo-reveal niet toegestaan'
          : 'Run is al gesynced naar Pipedrive - Apollo-reveal niet meer mogelijk',
      },
      { status: 400 },
    )
  }

  const svc = new EnrichmentOrchestratorService()
  try {
    const result = await svc.revealColdContacts(id, apolloIds)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[reveal-contacts] failed', id, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = withAuth(handler)
