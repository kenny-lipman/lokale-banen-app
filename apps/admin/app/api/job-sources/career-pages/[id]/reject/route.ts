// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { reject, rejectInputSchema } from '@/lib/services/career-page-sources/source.service'

type Ctx = { params: Promise<{ id: string }> }

async function postHandler(req: NextRequest, auth: AuthResult, ctx: Ctx) {
  const { id } = await ctx.params
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // empty body OK
  }
  const parsed = rejectInputSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige input', issues: parsed.error.issues }, { status: 400 })
  }
  try {
    const row = await reject(id, auth.user.id, parsed.data)
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
