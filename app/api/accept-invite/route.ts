import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: Request) {
  // Rate limiting: max 5 per 10 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"
  const rl = rateLimit(`accept-invite:${ip}`, 5, 10 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Probeer het later opnieuw." }, { status: 429 })
  }
  try {
    const { token, fullName, password } = await req.json()
    if (!token || !fullName || !password) {
      return NextResponse.json({ error: "token, fullName en password vereist" }, { status: 400 })
    }
    // Zoek invitation op
    const { data: invitation, error: inviteError } = await supabaseService.client
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single()
    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Ongeldige of verlopen uitnodiging" }, { status: 400 })
    }
    if (invitation.accepted) {
      return NextResponse.json({ error: "Uitnodiging is al geaccepteerd" }, { status: 400 })
    }
    // Maak account aan via Supabase Auth
    const { data: signUpData, error: signUpError } = await supabaseService.client.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: { full_name: fullName, role: invitation.role },
        user_metadata: { full_name: fullName }
      }
    })
    if (signUpError) {
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }
    // Markeer invitation als geaccepteerd
    await supabaseService.client
      .from("invitations")
      .update({ accepted: true })
      .eq("id", invitation.id)
    // Update profiel (optioneel, want signUp data bevat full_name/role)
    // const { user } = signUpData
    // if (user) {
    //   await supabaseService.client.from("profiles").update({ full_name: fullName, role: invitation.role }).eq("id", user.id)
    // }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.toString() }, { status: 500 })
  }
} 