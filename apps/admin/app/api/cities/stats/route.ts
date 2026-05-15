import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

async function handler(req: NextRequest, auth: AuthResult) {
  const { data, error } = await auth.supabase.rpc('cities_stats').single()
  if (error) {
    console.error('cities_stats RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ stats: data })
}

export const GET = withAdminAuth(handler)
