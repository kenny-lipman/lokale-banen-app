import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"

async function regionsGetHandler(req: NextRequest, authResult: AuthResult) {
  try {
    // Use platforms table (regions table doesn't exist)
    const { data: regions, error } = await authResult.supabase
      .from('platforms')
      .select('id, regio_platform, central_place, central_postcode, is_active, instantly_campaign_id')
      .order('regio_platform')

    if (error) throw error

    return NextResponse.json({ success: true, regions: regions || [] })
  } catch (error) {
    console.error("Error fetching regions:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch regions" },
      { status: 500 }
    )
  }
}

async function regionsPostHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const body = await req.json()
    const { regio_platform, central_place, central_postcode } = body

    // Validate required fields
    if (!regio_platform) {
      return NextResponse.json(
        { success: false, error: "regio_platform is required" },
        { status: 400 }
      )
    }

    // Create new platform
    const { data: newPlatform, error } = await authResult.supabase
      .from('platforms')
      .insert({
        regio_platform,
        central_place: central_place || null,
        central_postcode: central_postcode || null,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: newPlatform })
  } catch (error) {
    console.error("Error creating region:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create region" },
      { status: 500 }
    )
  }
}

export const GET = withAuth(regionsGetHandler)
export const POST = withAuth(regionsPostHandler)
