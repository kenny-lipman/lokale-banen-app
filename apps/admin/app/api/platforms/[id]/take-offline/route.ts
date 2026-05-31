// @auth SESSION
import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { unpublishPlatform } from "@/lib/services/platform-publication.service"

export const dynamic = "force-dynamic"

async function postHandler(
  _request: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = createServiceRoleClient()
    const result = await unpublishPlatform(supabase, id)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      )
    }

    return NextResponse.json({
      data: { ...result.data, approved_count: result.approvedCount ?? 0 },
      message: "Platform offline",
      revalidate: result.revalidate,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
