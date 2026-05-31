// @auth PUBLIC
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { hashResetToken } from '@/lib/auth/password-reset'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`reset-confirm:ip:${ip}`, 10, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit overschreden.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!token) {
    return NextResponse.json({ error: 'Token ontbreekt' }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens bevatten' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const tokenHash = hashResetToken(token)

  const { data: tokenRow, error: lookupError } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, used_at, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (lookupError || !tokenRow) {
    return NextResponse.json({ error: 'Ongeldige of verlopen reset-link' }, { status: 400 })
  }
  if (tokenRow.used_at) {
    return NextResponse.json({ error: 'Deze reset-link is al gebruikt' }, { status: 400 })
  }
  if (new Date(tokenRow.expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Deze reset-link is verlopen' }, { status: 400 })
  }

  // Update wachtwoord via service role.
  const { error: updateError } = await supabase.auth.admin.updateUserById(tokenRow.user_id, { password })
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Markeer token als gebruikt.
  await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  // Invalideer alle bestaande sessies → user moet overal opnieuw inloggen met het nieuwe wachtwoord.
  await supabase.auth.admin.signOut(tokenRow.user_id, 'global')

  return NextResponse.json({ success: true })
}
