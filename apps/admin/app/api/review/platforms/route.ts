import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

export async function GET() {
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

    // Get approved vacancy counts per platform
    const { data: counts, error: countError } = await supabase
      .rpc("exec_sql", {
        sql: `
          SELECT platform_id, COUNT(*)::int as count
          FROM job_postings
          WHERE review_status = 'approved' AND platform_id IS NOT NULL
          GROUP BY platform_id
        `,
      })
      .catch(async () => {
        // Fallback: manual count via individual queries
        return { data: null, error: null }
      })

    // Build count map
    const countMap: Record<string, number> = {}
    if (Array.isArray(counts)) {
      for (const row of counts) {
        countMap[row.platform_id] = row.count
      }
    }

    // If rpc failed, get counts the regular way
    if (!Array.isArray(counts) && platforms) {
      for (const platform of platforms) {
        const { count } = await supabase
          .from("job_postings")
          .select("*", { count: "exact", head: true })
          .eq("review_status", "approved")
          .eq("platform_id", platform.id)
        countMap[platform.id] = count || 0
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
