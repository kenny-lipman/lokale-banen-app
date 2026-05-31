// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

async function handler(_req: NextRequest, _auth: AuthResult) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pipedrive_branche_options')
    .select('id, pipedrive_enum_id, label, sort_order, sbi_prefixes, active, synced_from_pipedrive_at, updated_at')
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ options: data ?? [] })
}

export const GET = withAdminAuth(handler)
