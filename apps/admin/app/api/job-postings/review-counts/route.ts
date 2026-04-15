import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

/**
 * GET /api/job-postings/review-counts
 *
 * Returns counts per review_status (pending/approved/rejected/all).
 * Used by the tabs on the /job-postings admin page to show badge counts.
 *
 * Optional query params mirror the RPC filters that the main table respects so
 * that the tab counts stay consistent with active filters. For now we only
 * honour `platform_id` (single uuid) since that is the most common cross-tab
 * filter. Other filters are intentionally ignored to keep the query cheap.
 */
async function getHandler(request: NextRequest, _authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const platformId = searchParams.get("platform_id") || null

    const buildQuery = (review: "pending" | "approved" | "rejected" | null) => {
      let q = supabase
        .from("job_postings")
        .select("*", { count: "exact", head: true })
      if (review) q = q.eq("review_status", review)
      if (platformId) q = q.eq("platform_id", platformId)
      return q
    }

    const [pending, approved, rejected, all] = await Promise.all([
      buildQuery("pending"),
      buildQuery("approved"),
      buildQuery("rejected"),
      buildQuery(null),
    ])

    const firstError =
      pending.error || approved.error || rejected.error || all.error
    if (firstError) {
      return NextResponse.json(
        { error: "Failed to fetch review counts", details: firstError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      counts: {
        pending: pending.count ?? 0,
        approved: approved.count ?? 0,
        rejected: rejected.count ?? 0,
        all: all.count ?? 0,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
