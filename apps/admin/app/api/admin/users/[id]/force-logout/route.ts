// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function forceLogoutHandler(_req: NextRequest, _auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const supabase = createServiceRoleClient()
  const { error } = await supabase.auth.admin.signOut(id, 'global')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export const POST = withAdminAuth(forceLogoutHandler)
