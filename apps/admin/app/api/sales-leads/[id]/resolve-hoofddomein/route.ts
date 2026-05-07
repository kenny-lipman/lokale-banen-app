import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { PlatformMatcherService } from '@/lib/services/sales-leads/platform-matcher.service'
import type { MasterRecord } from '@/lib/services/sales-leads/types'

type RouteContext = { params: Promise<{ id: string }> }

async function handler(_req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()

  const { data: run, error } = await supabase
    .from('sales_lead_runs')
    .select('master_record, owner_config_id')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!run) {
    return NextResponse.json({ error: 'run_not_found' }, { status: 404 })
  }

  const master = run.master_record as MasterRecord | null
  if (!master) {
    return NextResponse.json({ error: 'master_record_missing' }, { status: 409 })
  }

  const { data: cfg, error: cfgErr } = await supabase
    .from('sales_lead_owner_config')
    .select('hoofddomein_strategy')
    .eq('id', run.owner_config_id)
    .maybeSingle()
  if (cfgErr) {
    return NextResponse.json({ error: cfgErr.message }, { status: 500 })
  }
  if (cfg?.hoofddomein_strategy !== 'auto_match_by_address') {
    return NextResponse.json({ error: 'strategy_not_auto_match' }, { status: 409 })
  }

  const matcher = new PlatformMatcherService()
  const match = await matcher.matchByAddress({
    postcode: master.address?.postcode,
    city: master.address?.city,
  })

  if (!match) {
    return NextResponse.json({ matched: false, hoofddomein: null }, { status: 200 })
  }

  // Update master_record.hoofddomein in DB (atomic via jsonb_set niet nodig:
  // hoofddomein-resolutie is single-writer vanuit UI-knop).
  const updated: MasterRecord = { ...master, hoofddomein: match.regio_platform }
  const { error: updErr } = await supabase
    .from('sales_lead_runs')
    .update({ master_record: updated, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    matched: true,
    hoofddomein: match.regio_platform,
    platform_id: match.platform_id,
  })
}

export const POST = withAuth(handler)
