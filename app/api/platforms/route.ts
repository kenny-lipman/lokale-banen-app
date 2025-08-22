import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const stats = searchParams.get('stats')
    
    if (stats === 'true') {
      // Return platform statistics
      const platformStats = await supabaseService.getPlatformStats()
      return NextResponse.json({ success: true, data: platformStats })
    } else {
      // Return platform list
      const platforms = await supabaseService.getPlatforms()
      return NextResponse.json({ success: true, data: platforms })
    }
  } catch (error) {
    console.error("Error fetching platforms:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch platforms" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, central_place, central_postcode } = body

    // Validate required fields
    if (!name || !central_place || !central_postcode) {
      return NextResponse.json(
        { success: false, error: "Name, central_place, and central_postcode are required" },
        { status: 400 }
      )
    }

    // Validate postcode format (4 digits)
    if (!/^[0-9]{4}$/.test(central_postcode)) {
      return NextResponse.json(
        { success: false, error: "Central postcode must be 4 digits" },
        { status: 400 }
      )
    }

    const newPlatform = await supabaseService.createPlatform({
      regio_platform: name,
      central_place,
      central_postcode,
      is_active: false
    })

    return NextResponse.json({ success: true, data: newPlatform })
  } catch (error: any) {
    console.error("Error creating platform:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create platform" },
      { status: 500 }
    )
  }
}