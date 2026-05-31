// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { approve } from '@/lib/services/career-page-sources/source.service'

type Ctx = { params: Promise<{ id: string }> }

async function postHandler(_req: NextRequest, auth: AuthResult, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const row = await approve(id, auth.user.id)
    return NextResponse.json(row)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
