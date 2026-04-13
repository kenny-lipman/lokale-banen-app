import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"

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

    return NextResponse.json({
      rejected,
      message: `${rejected} vacature(s) afgekeurd`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
