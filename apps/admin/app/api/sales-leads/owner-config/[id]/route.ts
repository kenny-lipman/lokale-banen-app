import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

const UPDATABLE_FIELDS = [
  'label', 'pipedrive_user_id', 'pipedrive_pipeline_id', 'pipedrive_default_stage_id',
  'hoofddomein_strategy', 'hoofddomein_fixed_value', 'hoofddomein_fixed_option_id',
  'wetarget_flag_value',
  'contactmoment_field_key', 'contactmoment_offset_workdays', 'is_active', 'display_order',
] as const

async function patchHandler(req: NextRequest, _auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const updates: Partial<Record<typeof UPDATABLE_FIELDS[number], unknown>> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  for (const k of UPDATABLE_FIELDS) {
    if (k in body) updates[k] = body[k]
  }
  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: 'No updatable fields in body' }, { status: 400 })
  }
  if (updates.hoofddomein_strategy === 'fixed' && !updates.hoofddomein_fixed_value && !('hoofddomein_fixed_value' in body)) {
    return NextResponse.json({ error: 'hoofddomein_fixed_value required when strategy=fixed' }, { status: 400 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_owner_config')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ config: data })
}

export const PATCH = withAuth(patchHandler)
