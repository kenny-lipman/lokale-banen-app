import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { revalidatePublicSite } from "@/lib/services/public-site-revalidate.service"
import type { TablesUpdate } from "@/lib/supabase"

type PlatformUpdate = TablesUpdate<"platforms">

export const dynamic = "force-dynamic"

async function getHandler(
  request: NextRequest,
  authResult: AuthResult,
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

async function patchHandler(
  request: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient()
    const body = await request.json()

    // Whitelist of editable fields (all 6 tabs combined). Not in this list:
    // id, regio_platform, central_place, preview_domain, indexnow_key,
    // updated_at (set server-side), published_at (managed via go-live).
    const allowedFields = [
      // Basis
      "tier",
      "is_public",
      "domain",
      // Branding
      "logo_url",
      "favicon_url",
      "og_image_url",
      "primary_color",
      // Content
      "hero_title",
      "hero_subtitle",
      "about_text",
      "privacy_text",
      "terms_text",
      // SEO
      "seo_description",
      // Contact
      "contact_email",
      "contact_phone",
      "social_linkedin",
      "social_instagram",
      "social_facebook",
      "social_tiktok",
      "social_twitter",
    ] as const

    const updates: PlatformUpdate = {}
    for (const field of allowedFields) {
      if (field in body) {
        ;(updates as Record<string, unknown>)[field] = body[field]
      }
    }

    // Keep published_at in sync with is_public toggles from the UI. The
    // dedicated /go-live endpoint is still the canonical "publish" path but
    // this keeps the toggle on the Basics tab functional too.
    if ("is_public" in updates) {
      if (updates.is_public === true) {
        updates.published_at = new Date().toISOString()
      } else if (updates.is_public === false) {
        updates.published_at = null
      }
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

    // Best-effort: invalidate public-site caches for this platform.
    const revalidate = await revalidatePublicSite({ platformIds: [id] })
    if (!revalidate.ok && !revalidate.skipped) {
      console.warn(`[platforms PATCH] revalidate failed for ${id}:`, revalidate.error)
    }

    const { count } = await supabase
      .from("job_postings")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "approved")
      .eq("platform_id", id)

    return NextResponse.json({
      data: { ...data, approved_count: count || 0 },
      message: "Platform bijgewerkt",
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
export const PATCH = withAuth(patchHandler)
