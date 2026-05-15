import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

async function handler(req: NextRequest, auth: AuthResult) {
  const body = await req.json().catch(() => null) as
    | { ids?: string[]; platform_id?: string | null; activate?: boolean }
    | null
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0)
    return NextResponse.json({ error: 'ids ontbreekt' }, { status: 400 })

  const ids = body.ids.filter((x) => typeof x === 'string' && x.length === 36)
  if (ids.length === 0) return NextResponse.json({ error: 'geen geldige ids' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if ('platform_id' in body) update.platform_id = body.platform_id ?? null
  if (typeof body.activate === 'boolean') update.is_active = body.activate

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'geen velden om te updaten' }, { status: 400 })

  const { error, count } = await auth.supabase
    .from('cities')
    .update(update, { count: 'exact' })
    .in('id', ids)
  if (error) {
    console.error('cities bulk-link error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ updated: count ?? ids.length })
}

export const POST = withAdminAuth(handler)
