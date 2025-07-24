import { NextResponse } from "next/server"
import { supabaseService } from "@/lib/supabase-service"

export async function GET() {
  try {
    const regions = await supabaseService.getRegions()
    return NextResponse.json({ success: true, data: regions })
  } catch (error) {
    console.error("Error fetching regions:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch regions" },
      { status: 500 }
    )
  }
} 