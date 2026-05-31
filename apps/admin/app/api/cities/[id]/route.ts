// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { cityPatchSchema } from '@/lib/cities/schemas'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function patchHandler(req: NextRequest, auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 })

  const raw = await req.json().catch(() => null)
  const parsed = cityPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { if_updated_at, ...input } = parsed.data

  // Optimistic-lock: bij if_updated_at-mismatch geef 409 zodat UI kan herladen
  if (if_updated_at) {
    const { data: current, error: fetchErr } = await auth.supabase
      .from('cities')
      .select('updated_at')
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!current) return NextResponse.json({ error: 'niet gevonden' }, { status: 404 })
    if (current.updated_at !== if_updated_at) {
      return NextResponse.json(
        { error: 'stale', current_updated_at: current.updated_at },
        { status: 409 },
      )
    }
  }

  const { data, error } = await auth.supabase
    .from('cities')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    // Unique-constraint conflict (plaats, postcode, platform_id) → 409
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', message: 'Deze plaats/postcode/platform-combinatie bestaat al' },
        { status: 409 },
      )
    }
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
