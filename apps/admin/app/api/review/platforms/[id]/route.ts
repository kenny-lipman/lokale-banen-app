import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient()

    const { data: platform, error } = await supabase
      .from("platforms")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !platform) {
      return NextResponse.json(
        { error: "Platform niet gevonden" },
        { status: 404 }
      )
    }

    // Get approved count
    const { count } = await supabase
      .from("job_postings")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "approved")
      .eq("platform_id", id)

    return NextResponse.json({
      data: { ...platform, approved_count: count || 0 },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient()
    const body = await request.json()

    // Only allow updating specific fields
    const allowedFields = [
      "domain",
      "is_public",
      "logo_url",
      "primary_color",
      "hero_title",
      "hero_subtitle",
      "seo_description",
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    // If setting is_public to true, also set published_at
    if (updates.is_public === true) {
      updates.published_at = new Date().toISOString()
    } else if (updates.is_public === false) {
      updates.published_at = null
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from("platforms")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Fout bij opslaan", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data,
      message: "Platform bijgewerkt",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
