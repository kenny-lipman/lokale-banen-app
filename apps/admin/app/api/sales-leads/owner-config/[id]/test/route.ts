import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function testHandler(_req: NextRequest, _auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()
  const { data: config, error } = await supabase
    .from('sales_lead_owner_config')
    .select('pipedrive_user_id, pipedrive_pipeline_id, pipedrive_default_stage_id, contactmoment_field_key')
    .eq('id', id)
    .single()
  if (error || !config) return NextResponse.json({ error: 'Config niet gevonden' }, { status: 404 })

  try {
    const service = new PipedriveMetaService()
    const result = await service.testConfig({
      pipedrive_user_id: config.pipedrive_user_id,
      pipedrive_pipeline_id: config.pipedrive_pipeline_id,
      pipedrive_default_stage_id: config.pipedrive_default_stage_id,
      contactmoment_field_key: config.contactmoment_field_key,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = withAuth(testHandler)
