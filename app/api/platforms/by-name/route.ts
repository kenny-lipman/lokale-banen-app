import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: "Platform name is required" },
        { status: 400 }
      )
    }

    const platform = await supabaseService.getPlatformByName(name)
    
    if (platform) {
      return NextResponse.json({ success: true, data: platform })
    } else {
      return NextResponse.json(
        { success: false, error: "Platform not found" },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error("Error fetching platform by name:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch platform" },
      { status: 500 }
    )
  }
}