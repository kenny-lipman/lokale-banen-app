import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
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

    const { error, count } = await supabase
      .from("job_postings")
      .update({
        review_status: "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .in("id", ids)

    if (error) {
      return NextResponse.json(
        { error: "Failed to reject job postings", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      rejected: ids.length,
      message: `${ids.length} vacature(s) afgekeurd`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
