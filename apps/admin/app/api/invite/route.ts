import { NextRequest, NextResponse } from "next/server"
import { withAdminAuth, AuthResult } from "@/lib/auth-middleware"
import { randomUUID } from "crypto"
import { rateLimit } from "@/lib/rate-limit"

async function inviteHandler(req: NextRequest, authResult: AuthResult) {
  // Rate limiting: max 5 per 10 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rl = rateLimit(`invite:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Probeer het later opnieuw." }, { status: 429 })
  }
  try {
    const { email, role } = await req.json()
    if (!email || !role) {
      return NextResponse.json({ error: "email en role vereist" }, { status: 400 })
    }
    const { user, profile } = authResult
    // Genereer unieke token
    const inviteToken = randomUUID() + Math.random().toString(36).slice(2, 10)
    // Voeg invitation toe
    const { error: inviteError } = await authResult.supabase
      .from("invitations")
      .insert({
        email,
        invited_by: profile.id,
        role,
        token: inviteToken
      })
    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }
    // TODO: Verstuur e-mail met invite link
    return NextResponse.json({ success: true, token: inviteToken })
  } catch (e: any) {
    return NextResponse.json({ error: e?.toString() }, { status: 500 })
  }
}

export const POST = withAdminAuth(inviteHandler) 