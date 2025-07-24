import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import { randomUUID } from "crypto"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: Request) {
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
    // Auth check: haal user uit headers (Supabase Auth session)
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 })
    }
    // Haal profiel op van ingelogde gebruiker
    const { data: { user }, error: userError } = await supabaseService.client.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: "Geen geldige gebruiker" }, { status: 401 })
    }
    // Haal profiel uit profiles tabel
    const { data: profile, error: profileError } = await supabaseService.client
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single()
    if (profileError || !profile) {
      return NextResponse.json({ error: "Profiel niet gevonden" }, { status: 403 })
    }
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Alleen admins mogen uitnodigen" }, { status: 403 })
    }
    // Genereer unieke token
    const inviteToken = randomUUID() + Math.random().toString(36).slice(2, 10)
    // Voeg invitation toe
    const { error: inviteError } = await supabaseService.client
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