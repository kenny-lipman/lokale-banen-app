// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function patchHandler(req: NextRequest, _auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const { role } = body as { role?: string }

  if (role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'Rol moet "admin" of "member" zijn' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.auth.admin.updateUserById(id, { app_metadata: { role } })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, role })
}

export const PATCH = withAdminAuth(patchHandler)
