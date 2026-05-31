// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import {
  list,
  create,
  listFiltersSchema,
  createInputSchema,
} from '@/lib/services/career-page-sources/source.service'

async function getHandler(req: NextRequest, auth: AuthResult) {
  void auth
  const params = Object.fromEntries(req.nextUrl.searchParams.entries())
  const parsed = listFiltersSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige filters', issues: parsed.error.issues }, { status: 400 })
  }
  try {
    const result = await list(parsed.data)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function postHandler(req: NextRequest, auth: AuthResult) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body moet JSON zijn' }, { status: 400 })
  }
  const parsed = createInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige input', issues: parsed.error.issues }, { status: 400 })
  }
  try {
    const row = await create(parsed.data, auth.user.id)
    return NextResponse.json(row, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
export const POST = withAuth(postHandler)
