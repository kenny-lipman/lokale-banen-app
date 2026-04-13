import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]

async function postHandler(
  request: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Geen bestand geüpload" },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Ongeldig bestandstype. Toegestaan: PNG, JPEG, SVG, WebP" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Bestand te groot. Maximum is 5MB" },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Verify platform exists
    const { data: platform, error: platformError } = await supabase
      .from("platforms")
      .select("id")
      .eq("id", id)
      .single()

    if (platformError || !platform) {
      return NextResponse.json(
        { error: "Platform niet gevonden" },
        { status: 404 }
      )
    }

    const mimeToExt: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/svg+xml": "svg",
      "image/webp": "webp",
    }
    const ext = mimeToExt[file.type]
    if (!ext) {
      return NextResponse.json(
        { error: `Ongeldig bestandstype: ${file.type}. Toegestaan: PNG, JPG, SVG, WebP` },
        { status: 400 }
      )
    }
    const path = `${id}/logo.${ext}`

    // Convert File to ArrayBuffer for Supabase upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from("platform-assets")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload mislukt: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("platform-assets").getPublicUrl(path)

    // Update platform record
    const { error: updateError } = await supabase
      .from("platforms")
      .update({
        logo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (updateError) {
      return NextResponse.json(
        { error: `Database update mislukt: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: publicUrl,
      message: "Logo geüpload",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
