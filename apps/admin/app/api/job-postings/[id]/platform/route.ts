// @auth SESSION
import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from '@/lib/auth-middleware'

type Ctx = { params: Promise<{ id: string }> }

async function patchHandler(
  request: NextRequest,
  auth: AuthResult,
  { params }: Ctx
) {
  try {
    const supabase = auth.supabase

    const { platform_id } = await request.json()
    const { id } = await params

    // Update the job posting's platform_id
    const { data, error } = await supabase
      .from("job_postings")
      .update({ platform_id })
      .eq("id", id)
      .select(`
        id,
        platform_id,
        platforms:platform_id(id, regio_platform)
      `)
      .single()

    if (error) {
      console.error("Error updating job posting platform:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        platform_id: data.platform_id,
        regio_platform: data.platforms?.regio_platform || null
      }
    })
  } catch (error: any) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export const PATCH = withAuth(patchHandler)
