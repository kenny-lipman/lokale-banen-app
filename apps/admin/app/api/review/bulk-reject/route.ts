import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { revalidatePublicSite } from "@/lib/services/public-site-revalidate.service"

export const dynamic = "force-dynamic"

async function postHandler(request: NextRequest, authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { error: "No job posting IDs provided" },
        { status: 400 }
      )
    }

    // Capture platform_ids and slugs before the update so we can invalidate
    // cache for pages that were previously serving these jobs.
    const { data: previouslyApproved } = await supabase
      .from("job_postings")
      .select("platform_id, slug")
      .in("id", ids)
      .eq("review_status", "approved")

    const { data, error } = await supabase
      .from("job_postings")
      .update({
        review_status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: authResult.user?.id || null,
        published_at: null,
      })
      .in("id", ids)
      .select("id")

    if (error) {
      return NextResponse.json(
        { error: "Failed to reject job postings", details: error.message },
        { status: 500 }
      )
    }

    const rejected = data?.length || 0

    const affectedPlatformIds = new Set<string>()
    const affectedSlugs: string[] = []
    for (const row of previouslyApproved ?? []) {
      if (row.platform_id) affectedPlatformIds.add(row.platform_id)
      if (row.slug) affectedSlugs.push(row.slug)
    }

    const revalidateResult = await revalidatePublicSite({
      platformIds: Array.from(affectedPlatformIds),
      jobSlugs: affectedSlugs,
    })

    return NextResponse.json({
      rejected,
      revalidated: revalidateResult.ok,
      message: `${rejected} vacature(s) afgekeurd`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
