import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function handler(_req: NextRequest, _auth: AuthResult) {
  // RPC heeft alleen service_role-grant; user-token mag niet rechtstreeks aanroepen.
  const svc = createServiceRoleClient()
  const { data, error } = await svc.rpc('cities_stats').single()
  if (error) {
    console.error('cities_stats RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ stats: data })
}

export const GET = withAdminAuth(handler)
