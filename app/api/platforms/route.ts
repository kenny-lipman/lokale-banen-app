import { NextRequest, NextResponse } from "next/server"
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  try {
    // Get the current user from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Create an authenticated client using the user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const stats = searchParams.get('stats')
    
    if (stats === 'true') {
      // Return platform statistics with correct structure
      const { data: platforms, error } = await supabase
        .from('platforms')
        .select('is_active')

      if (error) {
        throw error
      }

      const total = platforms?.length || 0
      const active = platforms?.filter(p => p.is_active).length || 0
      const inactive = total - active

      return NextResponse.json({ 
        success: true, 
        data: {
          total,
          active,
          inactive
        }
      })
    } else {
      // Return all platforms with automation and active status
      const { data: platforms, error } = await supabase
        .from('platforms')
        .select('id, regio_platform, central_place, central_postcode, automation_enabled, is_active')
        .order('regio_platform', { ascending: true })

      if (error) {
        console.error('Error fetching platforms:', error)
        throw error
      }

      const platformsData = platforms || []
      const enabledCount = platformsData.filter(p => p.automation_enabled).length

      // Debug logging
      console.log(`[DEBUG] Platforms API: ${enabledCount} of ${platformsData.length} platforms enabled`)

      return NextResponse.json({
        platforms: platformsData,
        totalCount: platformsData.length,
        enabledCount: enabledCount
      }, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate' // Disable cache during debugging
        }
      })
    }
  } catch (error) {
    console.error("Error fetching platforms:", error)
    return NextResponse.json(
      { error: "Failed to fetch platforms" },
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