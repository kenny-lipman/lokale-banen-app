import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

async function handler(req: NextRequest, auth: AuthResult) {
  const body = (await req.json().catch(() => null)) as { ids?: string[] } | null
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0)
    return NextResponse.json({ error: 'ids ontbreekt' }, { status: 400 })

  const ids = body.ids.filter((x) => typeof x === 'string' && x.length === 36)
  if (ids.length === 0) return NextResponse.json({ count: 0 })

  const { data, error } = await auth.supabase.rpc('cities_pending_jobs_count', { p_ids: ids })
  if (error) {
    console.error('cities_pending_jobs_count RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ count: data ?? 0 })
}

export const POST = withAdminAuth(handler)
