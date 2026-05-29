// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function deleteHandler(_req: NextRequest, auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  if (id === auth.user.id) {
    return NextResponse.json({ error: 'Je kunt je eigen account niet verwijderen' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export const DELETE = withAdminAuth(deleteHandler)
