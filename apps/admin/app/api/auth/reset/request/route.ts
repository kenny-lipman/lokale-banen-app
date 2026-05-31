// @auth PUBLIC
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { rateLimit } from '@/lib/rate-limit'
import { generateResetToken, hashResetToken, buildResetLink, RESET_TOKEN_TTL_MS } from '@/lib/auth/password-reset'
import { passwordResetEmail } from '@/lib/email/password-reset-email'
import { getResendClient } from '@/lib/email/resend-client'

export const runtime = 'nodejs'

// Geheime succes-response — altijd hetzelfde, ongeacht of email bestaat.
const SILENT_OK = NextResponse.json({ success: true })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ua = req.headers.get('user-agent') ?? null

  const ipRl = rateLimit(`reset-req:ip:${ip}`, 5, 60 * 60 * 1000)
  if (!ipRl.allowed) {
    return NextResponse.json({ error: 'Rate limit overschreden. Probeer het later opnieuw.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Geldig e-mailadres vereist' }, { status: 400 })
  }

  const emailRl = rateLimit(`reset-req:email:${email}`, 3, 60 * 60 * 1000)
  if (!emailRl.allowed) {
    // Stille succes om enumeration te voorkomen; user merkt vanzelf dat er nog geen mail is.
    return SILENT_OK
  }

  const supabase = createServiceRoleClient()

  // Lookup user op email — service role bypassed RLS.
  // Note: auth.admin.listUsers heeft geen email-filter; we vragen profiles.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!profile) {
    return SILENT_OK // geen leak
  }

  // Invalideer alle eerdere niet-gebruikte tokens van deze user (behoud audit-trail via used_at).
  await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('used_at', null)

  const plaintext = generateResetToken()
  const tokenHash = hashResetToken(plaintext)
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString()

  const { error: insertError } = await supabase.from('password_reset_tokens').insert({
    user_id: profile.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    requested_ip: ip,
    user_agent: ua,
  })
  if (insertError) {
    console.error('reset/request: insert failed', insertError)
    return SILENT_OK
  }

  // Verstuur email via Resend.
  try {
    const link = buildResetLink(plaintext)
    const { subject, html, text } = passwordResetEmail(link)
    await getResendClient().emails.send({
      from: 'Lokale Banen <noreply@cas.works>',
      to: email,
      subject,
      html,
      text,
    })
  } catch (err) {
    console.error('reset/request: email send failed', err)
    // Toch silent OK — de token staat in de DB; de user kan opnieuw aanvragen.
  }

  return SILENT_OK
}
