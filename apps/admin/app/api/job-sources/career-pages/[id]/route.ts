// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import {
  getById,
  update,
  remove,
  updateInputSchema,
} from '@/lib/services/career-page-sources/source.service'

type Ctx = { params: Promise<{ id: string }> }

async function getHandler(_req: NextRequest, _auth: AuthResult, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const row = await getById(id)
    if (!row) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function patchHandler(req: NextRequest, _auth: AuthResult, ctx: Ctx) {
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body moet JSON zijn' }, { status: 400 })
  }
  const parsed = updateInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige input', issues: parsed.error.issues }, { status: 400 })
  }
  try {
    const row = await update(id, parsed.data)
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function deleteHandler(_req: NextRequest, _auth: AuthResult, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    await remove(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
export const PATCH = withAuth(patchHandler)
export const DELETE = withAuth(deleteHandler)
