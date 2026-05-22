import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Json } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

async function getHandler(_req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_runs')
    .select(
      'id,status,input_url,input_domain,owner_config_id,scrape_vacancies,manual_vacancies,enrichments,master_record,selected_contacts,pipedrive_org_id,pipedrive_deal_id,pipedrive_person_ids,existing_pipedrive_org_id,branche_override,error,created_at,updated_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  return NextResponse.json({ run: data })
}

async function patchHandler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as
    | { master_record?: unknown; selected_contacts?: unknown }
    | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const update: {
    updated_at: string
    master_record?: Json
    selected_contacts?: Json
  } = { updated_at: new Date().toISOString() }
  let touched = false
  if ('master_record' in body && body.master_record !== undefined) {
    update.master_record = body.master_record as Json
    touched = true
  }
  if ('selected_contacts' in body && body.selected_contacts !== undefined) {
    if (!Array.isArray(body.selected_contacts)) {
      return NextResponse.json({ error: 'selected_contacts moet array zijn' }, { status: 400 })
    }
    update.selected_contacts = body.selected_contacts as Json
    touched = true
  }
  if (!touched) {
    return NextResponse.json({ error: 'Niets om te updaten' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: updated, error } = await supabase
    .from('sales_lead_runs')
    .update(update)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export const GET = withAuth(getHandler)
export const PATCH = withAuth(patchHandler)
