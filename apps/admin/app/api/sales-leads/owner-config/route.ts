import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function listHandler(_req: NextRequest, _auth: AuthResult) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_owner_config')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}

async function createHandler(req: NextRequest, _auth: AuthResult) {
  const body = await req.json()
  const required = ['key', 'label', 'pipedrive_user_id', 'pipedrive_pipeline_id', 'pipedrive_default_stage_id', 'hoofddomein_strategy']
  for (const k of required) {
    if (!(k in body)) return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 })
  }
  if (body.hoofddomein_strategy === 'fixed' && !body.hoofddomein_fixed_value) {
    return NextResponse.json({ error: 'hoofddomein_fixed_value required when strategy=fixed' }, { status: 400 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_owner_config')
    .insert({
      key: body.key,
      label: body.label,
      pipedrive_user_id: body.pipedrive_user_id,
      pipedrive_pipeline_id: body.pipedrive_pipeline_id,
      pipedrive_default_stage_id: body.pipedrive_default_stage_id,
      hoofddomein_strategy: body.hoofddomein_strategy,
      hoofddomein_fixed_value: body.hoofddomein_fixed_value ?? null,
      wetarget_flag_value: body.wetarget_flag_value ?? 301,
      contactmoment_field_key: body.contactmoment_field_key ?? null,
      contactmoment_offset_workdays: body.contactmoment_offset_workdays ?? 1,
      is_active: body.is_active ?? true,
      display_order: body.display_order ?? 100,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data }, { status: 201 })
}

export const GET = withAdminAuth(listHandler)
export const POST = withAdminAuth(createHandler)
