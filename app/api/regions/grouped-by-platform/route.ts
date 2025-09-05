import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

interface GroupedRegionsResponse {
  platforms: {
    platform: string;
    centralPlace?: {
      central_place: string;
      central_postcode?: string;
    };
    automation_enabled: boolean;
    is_active: boolean;
    regions: {
      id: string;
      plaats: string;
      postcode: string;
    }[];
  }[];
}

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

    // Fetch platforms data first - this should be our authoritative list of platforms
    // Now including automation_enabled and is_active from platforms table
    const { data: centralPlaces, error: centralPlacesError } = await supabase
      .from('platforms')
      .select('regio_platform, central_place, central_postcode, automation_enabled, is_active')

    if (centralPlacesError) {
      console.error('Error fetching central places:', centralPlacesError)
      return NextResponse.json(
        { error: 'Failed to fetch central places' },
        { status: 500 }
      )
    }

    // Query to get cities grouped by platform
    const { data: regions, error } = await supabase
      .from('cities')
      .select(`
        id,
        plaats,
        postcode,
        regio_platform,
        platform_id
      `)
      .not('regio_platform', 'is', null)
      .order('regio_platform', { ascending: true })
      .order('plaats', { ascending: true })

    if (error) {
      console.error('Error fetching regions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch regions' },
        { status: 500 }
      )
    }

    // Create lookup maps
    const centralPlacesMap = new Map<string, { 
      central_place: string; 
      central_postcode?: string;
      automation_enabled: boolean;
      is_active: boolean;
    }>()
    
    centralPlaces?.forEach(cp => {
      centralPlacesMap.set(cp.regio_platform, {
        central_place: cp.central_place,
        central_postcode: cp.central_postcode,
        automation_enabled: cp.automation_enabled ?? false,
        is_active: cp.is_active ?? false
      })
    })

    // First, create platform groups for ALL platforms (including those without cities)
    const platformGroups = new Map<string, Array<{
      id: string;
      plaats: string;
      postcode: string;
    }>>()

    // Initialize with ALL active platforms from central places
    centralPlaces?.forEach(cp => {
      platformGroups.set(cp.regio_platform, [])
    })
    
    // Then add regions to their respective platforms
    regions?.forEach(region => {
      const platform = region.regio_platform || 'Unknown'
      
      if (!platformGroups.has(platform)) {
        // This platform exists in cities but not in platforms table - add it anyway
        platformGroups.set(platform, [])
      }
      
      platformGroups.get(platform)!.push({
        id: region.id,
        plaats: region.plaats,
        postcode: region.postcode
      })
    })

    // Convert to response format - sort by platform name
    const response: GroupedRegionsResponse = {
      platforms: Array.from(platformGroups.entries())
        .sort(([a], [b]) => a.localeCompare(b, 'nl'))
        .map(([platform, regions]) => {
          const platformData = centralPlacesMap.get(platform)
          return {
            platform,
            centralPlace: platformData ? {
              central_place: platformData.central_place,
              central_postcode: platformData.central_postcode
            } : undefined,
            automation_enabled: platformData?.automation_enabled ?? false,
            is_active: platformData?.is_active ?? false,
            regions
          }
        })
    }

    // Add debug logging
    const totalPlatforms = response.platforms.length
    const enabledPlatforms = response.platforms.filter(p => p.automation_enabled).length
    console.log(`[DEBUG] Grouped platforms API: ${enabledPlatforms} of ${totalPlatforms} platforms enabled`)
    console.log(`[DEBUG] Total platforms from DB: ${centralPlaces?.length || 0}`)
    console.log(`[DEBUG] Enabled platforms from DB: ${centralPlaces?.filter(cp => cp.automation_enabled).length || 0}`)

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate' // Disable cache during debugging
      }
    })

  } catch (error) {
    console.error('Unexpected error in grouped regions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 