import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import {
  EnrichmentOrchestratorService,
  type KvkLookupOverride,
} from '@/lib/services/sales-leads/enrichment-orchestrator.service'

export const maxDuration = 300
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_SOURCES = ['kvk', 'google_maps', 'apollo', 'website'] as const
type SourceName = (typeof VALID_SOURCES)[number]

const VALID_OVERRIDE_VIA = ['website', 'manual', 'maps', 'apollo'] as const

type ReplayBody = {
  source?: string
  override?: {
    kvkNumber?: string
    name?: string
    via?: string
  }
}

/**
 * Re-run één specifieke bron op een bestaande run zonder de andere bron-data
 * te verliezen. Gebruikt voor de "Opnieuw" knop per source-card, en voor de
 * KvK-recovery-UI (suggestion-chips + manual search) wanneer KvK 'not_found'
 * gaf op de domein-guess.
 *
 * Run kan in elke status zijn behalve 'syncing'/'completed' — voor die zou
 * herrun een Pipedrive-resync vereisen wat niet binnen scope valt.
 */
async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as ReplayBody | null
  if (!body || !VALID_SOURCES.includes(body.source as SourceName)) {
    return NextResponse.json(
      { error: `source moet een van ${VALID_SOURCES.join(', ')} zijn` },
      { status: 400 },
    )
  }
  const source = body.source as SourceName

  let override: KvkLookupOverride | null = null
  if (body.override) {
    if (source !== 'kvk') {
      return NextResponse.json(
        { error: 'override is alleen toegestaan voor source=kvk' },
        { status: 400 },
      )
    }
    const parsed = parseKvkOverride(body.override)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    override = parsed.value
  }

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
  const work = override
    ? svc.runKvkWithOverride(id, override)
    : svc.runSingleSource(id, source)
  waitUntil(
    work.catch((e) => {
      console.error('[orchestrator/replay-source] unhandled', id, source, e)
    }),
  )

  return NextResponse.json({ ok: true, source, override })
}

function parseKvkOverride(
  raw: NonNullable<ReplayBody['override']>,
): { ok: true; value: KvkLookupOverride } | { ok: false; error: string } {
  const digits = (raw.kvkNumber ?? '').replace(/\D/g, '')
  const name = raw.name?.trim()
  const hasKvk = digits.length > 0
  const hasName = !!name
  if (hasKvk === hasName) {
    return { ok: false, error: 'override moet precies één van { kvkNumber, name } bevatten' }
  }
  if (hasKvk && !/^\d{8}$/.test(digits)) {
    return { ok: false, error: 'kvkNumber moet 8 cijfers zijn' }
  }
  if (hasName && (name!.length < 2 || name!.length > 200)) {
    return { ok: false, error: 'name moet 2-200 chars zijn' }
  }
  const via: KvkLookupOverride['via'] = VALID_OVERRIDE_VIA.includes(
    raw.via as (typeof VALID_OVERRIDE_VIA)[number],
  )
    ? (raw.via as KvkLookupOverride['via'])
    : 'manual'
  return {
    ok: true,
    value: hasKvk ? { kvkNumber: digits, via } : { name, via },
  }
}

export const POST = withAuth(handler)
