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

    // Query to get regions grouped by platform with central places
    const { data: regions, error } = await supabase
      .from('regions')
      .select(`
        id,
        plaats,
        postcode,
        regio_platform
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

    // Fetch central places data using the authenticated client
    const { data: centralPlaces, error: centralPlacesError } = await supabase
      .from('regio_platform_central_places')
      .select('regio_platform, central_place, central_postcode')
      .eq('is_active', true)

    if (centralPlacesError) {
      console.error('Error fetching central places:', centralPlacesError)
      // Continue without central places data rather than failing completely
    }

    // Fetch user's platform automation preferences
    const { data: platformPreferences, error: preferencesError } = await supabase
      .from('user_platform_automation_preferences')
      .select('regio_platform, automation_enabled')
      .eq('user_id', user.id)

    if (preferencesError) {
      console.error('Error fetching platform preferences:', preferencesError)
      // Continue without preferences data rather than failing completely
    }

    // Create lookup maps
    const centralPlacesMap = new Map<string, { central_place: string; central_postcode?: string }>()
    centralPlaces?.forEach(cp => {
      centralPlacesMap.set(cp.regio_platform, {
        central_place: cp.central_place,
        central_postcode: cp.central_postcode
      })
    })

    const preferencesMap = new Map<string, boolean>()
    platformPreferences?.forEach(pref => {
      preferencesMap.set(pref.regio_platform, pref.automation_enabled)
    })

    // Group regions by platform
    const platformGroups = new Map<string, Array<{
      id: string;
      plaats: string;
      postcode: string;
    }>>()
    
    regions?.forEach(region => {
      const platform = region.regio_platform || 'Unknown'
      
      if (!platformGroups.has(platform)) {
        platformGroups.set(platform, [])
      }
      
      platformGroups.get(platform)!.push({
        id: region.id,
        plaats: region.plaats,
        postcode: region.postcode
      })
    })

    // Convert to response format
    const response: GroupedRegionsResponse = {
      platforms: Array.from(platformGroups.entries()).map(([platform, regions]) => ({
        platform,
        centralPlace: centralPlacesMap.get(platform),
        automation_enabled: preferencesMap.get(platform) ?? false,
        regions
      }))
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // 5 minutes cache
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