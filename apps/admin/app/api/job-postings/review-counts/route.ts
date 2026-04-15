import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

interface CountRow {
  status_bucket: 'all' | 'pending' | 'approved' | 'rejected'
  row_count: number
  is_estimate: boolean
}

/**
 * GET /api/job-postings/review-counts
 *
 * Returns counts per review_status (pending/approved/rejected/all) for the
 * tabs on the admin job-postings page.
 *
 * Implementation: single RPC call to `get_job_posting_counts` which uses
 *   - reltuples estimate for unfiltered 'all' (instant)
 *   - LIMIT trick for pending (stops at 10001 — UI shows "10.000+")
 *   - exact counts for approved/rejected (small partial indexes)
 *
 * Response is cached for 5 minutes via Cache-Control. Invalidated naturally
 * when the user moves between tabs (next tick refetches) or when admin-side
 * mutations happen.
 */
async function getHandler(request: NextRequest, _authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const platformId = searchParams.get("platform_id") || null

    const { data, error } = await supabase.rpc('get_job_posting_counts', {
      platform_filter: platformId,
      count_cap: 10000,
    })

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch review counts", details: error.message },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as CountRow[]
    const counts = {
      all: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }
    const estimates = {
      all: false,
      pending: false,
      approved: false,
      rejected: false,
    }

    for (const row of rows) {
      counts[row.status_bucket] = row.row_count
      estimates[row.status_bucket] = row.is_estimate
    }

    return NextResponse.json(
      { counts, estimates },
      {
        headers: {
          // 5 min browser/CDN cache, 10 min stale-while-revalidate
          'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = withAuth(getHandler)
