// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

type RouteContext = { params: Promise<{ id: string }> }

async function handler(_req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_runs')
    .select('status')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  if (data.status === 'completed' || data.status === 'syncing') {
    return NextResponse.json(
      { error: `Cannot cancel run met status=${data.status}` },
      { status: 409 },
    )
  }
  const { error: updErr } = await supabase
    .from('sales_lead_runs')
    .update({ status: 'failed', error: 'Geannuleerd door user', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export const POST = withAuth(handler)
