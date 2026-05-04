import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { revalidatePublicSite } from "@/lib/services/public-site-revalidate.service"
import {
  publishPlatform,
  unpublishPlatform,
} from "@/lib/services/platform-publication.service"
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
      "secondary_color",
      "tertiary_color",
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

    // is_public-transities lopen via de gedeelde publish/unpublish flow zodat
    // de "Publiek"-toggle exact dezelfde safeguards heeft als de Go-Live tab:
    // false→true valideert content + provisioneert de Vercel-alias eerst,
    // true→false bust de host-cache. We doen dit eerst en strippen de flag
    // uit de overige veldenset zodat we 'm niet dubbel updaten.
    let publicationFlow:
      | { kind: "publish"; resp: Awaited<ReturnType<typeof publishPlatform>> }
      | { kind: "unpublish"; resp: Awaited<ReturnType<typeof unpublishPlatform>> }
      | null = null

    if ("is_public" in updates) {
      const desired = updates.is_public
      // Lees huidige state om geen no-op via de zware flow te draaien.
      const { data: current } = await supabase
        .from("platforms")
        .select("is_public")
        .eq("id", id)
        .single()
      const currentPublic = current?.is_public ?? false
      delete updates.is_public

      if (desired === true && !currentPublic) {
        const resp = await publishPlatform(supabase, id)
        if (!resp.ok) {
          return NextResponse.json(
            {
              error: resp.error,
              code: resp.code,
              details: resp.missing
                ? { missing_checks: resp.missing }
                : undefined,
              alias: resp.alias ?? undefined,
            },
            { status: resp.status },
          )
        }
        publicationFlow = { kind: "publish", resp }
      } else if (desired === false && currentPublic) {
        const resp = await unpublishPlatform(supabase, id)
        if (!resp.ok) {
          return NextResponse.json(
            { error: resp.error },
            { status: resp.status },
          )
        }
        publicationFlow = { kind: "unpublish", resp }
      }
      // desired === currentPublic: niets te doen.
    }

    updates.updated_at = new Date().toISOString()

    const hasOtherUpdates = Object.keys(updates).some(
      (k) => k !== "updated_at",
    )

    const { data, error } = hasOtherUpdates
      ? await supabase
          .from("platforms")
          .update(updates)
          .eq("id", id)
          .select()
          .single()
      : await supabase.from("platforms").select("*").eq("id", id).single()

    if (error) {
      return NextResponse.json(
        { error: "Fout bij opslaan", details: error.message },
        { status: 500 }
      )
    }

    // Best-effort: invalidate public-site caches voor de platform-tag. De
    // host-tags zijn al gebust door de publish/unpublish-flow als die liep;
    // hier bedekken we het normale veld-edit pad.
    let revalidate
    if (publicationFlow) {
      revalidate = publicationFlow.resp.revalidate
    } else {
      const hosts = [data.domain, data.preview_domain].filter(
        (h): h is string => typeof h === "string" && h.length > 0
      )
      revalidate = await revalidatePublicSite({ platformIds: [id], hosts })
      if (!revalidate.ok && !revalidate.skipped) {
        console.warn(`[platforms PATCH] revalidate failed for ${id}:`, revalidate.error)
      }
    }

    const { count } = await supabase
      .from("job_postings")
      .select("*", { count: "exact", head: true })
      .eq("review_status", "approved")
      .eq("platform_id", id)

    return NextResponse.json({
      data: { ...data, approved_count: count || 0 },
      message: "Platform bijgewerkt",
      alias: publicationFlow?.kind === "publish" ? publicationFlow.resp.alias : undefined,
      revalidate,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
export const PATCH = withAuth(patchHandler)
