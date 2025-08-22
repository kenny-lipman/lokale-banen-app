import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET() {
  try {
    const regions = await supabaseService.getRegionsWithJobPostingsCount()
    return NextResponse.json({ success: true, data: regions })
  } catch (error) {
    console.error("Error fetching regions:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch regions" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { plaats, postcode, regio_platform, platform_id, central_place, central_postcode, is_new_platform } = body

    // Validate required fields
    if (!plaats || !postcode || !regio_platform) {
      return NextResponse.json(
        { success: false, error: "Plaats, postcode, and regio_platform are required" },
        { status: 400 }
      )
    }

    // If creating new platform, validate additional fields
    if (is_new_platform && (!central_place || !central_postcode)) {
      return NextResponse.json(
        { success: false, error: "Central place and central postcode are required for new platforms" },
        { status: 400 }
      )
    }

    const newRegion = await supabaseService.createRegion({
      plaats,
      postcode,
      regio_platform,
      platform_id,
      central_place: is_new_platform ? central_place : undefined,
      central_postcode: is_new_platform ? central_postcode : undefined,
      is_new_platform
    })

    return NextResponse.json({ success: true, data: newRegion })
  } catch (error) {
    console.error("Error creating region:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create region" },
      { status: 500 }
    )
  }
} 