import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

async function getHandler(_request: NextRequest, _authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()

    // Get platforms with approved vacancy count
    const { data: platforms, error } = await supabase
      .from("platforms")
      .select("id, regio_platform, central_place, domain, is_public, tier, logo_url, primary_color, hero_title, hero_subtitle, seo_description, published_at")
      .order("regio_platform")

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch platforms", details: error.message },
        { status: 500 }
      )
    }

    // Get approved vacancy counts per platform in a single query
    const { data: counts } = await supabase
      .from("job_postings")
      .select("platform_id")
      .eq("review_status", "approved")
      .not("platform_id", "is", null)

    // Build count map in-memory
    const countMap: Record<string, number> = {}
    if (counts) {
      for (const row of counts) {
        if (row.platform_id) {
          countMap[row.platform_id] = (countMap[row.platform_id] || 0) + 1
        }
      }
    }

    const enrichedPlatforms = (platforms || []).map((p) => ({
      ...p,
      approved_count: countMap[p.id] || 0,
    }))

    return NextResponse.json({ data: enrichedPlatforms })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
