// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { pendingJobsSchema } from '@/lib/cities/schemas'

async function handler(req: NextRequest, _auth: AuthResult) {
  const raw = await req.json().catch(() => null)
  const parsed = pendingJobsSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const svc = createServiceRoleClient()
  const { data, error } = await svc.rpc('cities_pending_jobs_count', { p_ids: parsed.data.ids })
  if (error) {
    console.error('cities_pending_jobs_count RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ count: data ?? 0 })
}

export const POST = withAdminAuth(handler)
