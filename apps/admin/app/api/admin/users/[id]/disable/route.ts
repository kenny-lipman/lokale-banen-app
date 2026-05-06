import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

// Soft-delete: ban_duration van 10 jaar. Re-activeren via /enable.
async function disableHandler(_req: NextRequest, auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  if (id === auth.user.id) {
    return NextResponse.json({ error: 'Je kunt je eigen account niet disablen' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: '87600h' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bestaande sessies invalideren zodat de user direct uitlogt.
  await supabase.auth.admin.signOut(id, 'global')

  return NextResponse.json({ success: true })
}

export const POST = withAdminAuth(disableHandler)
