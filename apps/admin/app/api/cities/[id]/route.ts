import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function patchHandler(req: NextRequest, auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 })

  const body = await req.json().catch(() => null) as
    | { plaats?: string; postcode?: string; platform_id?: string | null; is_active?: boolean }
    | null
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (typeof body.plaats === 'string' && body.plaats.trim()) update.plaats = body.plaats.trim()
  if (typeof body.postcode === 'string') update.postcode = body.postcode.trim() || null
  if ('platform_id' in body) update.platform_id = body.platform_id ?? null
  if (typeof body.is_active === 'boolean') update.is_active = body.is_active

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'geen velden om te updaten' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('cities')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('cities PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ city: data })
}

async function deleteHandler(req: NextRequest, auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 })

  const { error } = await auth.supabase.from('cities').delete().eq('id', id)
  if (error) {
    console.error('cities DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export const PATCH = withAdminAuth(patchHandler)
export const DELETE = withAdminAuth(deleteHandler)
