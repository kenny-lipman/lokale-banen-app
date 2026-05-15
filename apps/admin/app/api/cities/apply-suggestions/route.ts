import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function handler(_req: NextRequest, _auth: AuthResult) {
  const svc = createServiceRoleClient()
  const { data, error } = await svc.rpc('apply_pc4_suggestions')
  if (error) {
    console.error('apply_pc4_suggestions RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ updated: data ?? 0 })
}

export const POST = withAdminAuth(handler)
