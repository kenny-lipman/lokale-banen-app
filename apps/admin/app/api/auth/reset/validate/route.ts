// @auth PUBLIC
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { hashResetToken } from '@/lib/auth/password-reset'

export const runtime = 'nodejs'

// Lichte check voor de reset-pagina — voorkomt dat user wachtwoord typt op een
// expired/used/invalid token.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('used_at, expires_at')
    .eq('token_hash', hashResetToken(token))
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ valid: false, reason: 'invalid' })
  }
  if (data.used_at) {
    return NextResponse.json({ valid: false, reason: 'used' })
  }
  if (new Date(data.expires_at) <= new Date()) {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }
  return NextResponse.json({ valid: true })
}
