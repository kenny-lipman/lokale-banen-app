import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { PipedriveSyncService } from '@/lib/services/sales-leads/pipedrive-sync.service'

type RouteContext = { params: Promise<{ id: string }> }

async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  let orgMode: 'auto' | 'new' | 'existing' = 'auto'
  try {
    const body = (await req.json()) as {
      org_mode?: 'auto' | 'new' | 'existing'
      force_duplicate?: boolean
    }
    if (body?.org_mode === 'new' || body?.org_mode === 'existing' || body?.org_mode === 'auto') {
      orgMode = body.org_mode
    } else if (body?.force_duplicate === true) {
      // Backward-compat: oude clients stuurden force_duplicate voor nieuwe org.
      orgMode = 'new'
    }
  } catch {
    // empty body - default orgMode='auto'
  }

  const service = new PipedriveSyncService()
  try {
    const result = await service.syncLeadToPipedrive(id, orgMode)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const POST = withAuth(handler)

// 5 min timeout — sync inclusief ~10 Pipedrive-calls + DB-werk past in 30-60s,
// maar bij rate-limit-backoff (Pipedrive 100/10s) kan dit oplopen.
export const maxDuration = 300
