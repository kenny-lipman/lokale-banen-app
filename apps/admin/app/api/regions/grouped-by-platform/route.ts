// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import type { Database } from '@/lib/supabase'

type PlatformRow = Database['public']['Tables']['platforms']['Row']
type CityRow = Database['public']['Tables']['cities']['Row'] & {
  platforms: { regio_platform: string } | { regio_platform: string }[] | null
}

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

async function getHandler(request: NextRequest, auth: AuthResult) {
  try {
    const supabase = auth.supabase

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

    // Query to get cities grouped by platform - leest regio_platform via JOIN met platforms
    const { data: regions, error } = await supabase
      .from('cities')
      .select(`
        id,
        plaats,
        postcode,
        platform_id,
        platforms!cities_platform_id_fkey!inner ( regio_platform )
      `)
      .not('platform_id', 'is', null)
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

    centralPlaces?.forEach((cp: PlatformRow) => {
      centralPlacesMap.set(cp.regio_platform, {
        central_place: cp.central_place,
        central_postcode: cp.central_postcode ?? undefined,
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
    centralPlaces?.forEach((cp: PlatformRow) => {
      platformGroups.set(cp.regio_platform, [])
    })

    // Then add regions to their respective platforms
    regions?.forEach((region: CityRow) => {
      const platformsRel = region.platforms
      const platform = Array.isArray(platformsRel)
        ? (platformsRel[0]?.regio_platform ?? 'Unknown')
        : (platformsRel?.regio_platform ?? 'Unknown')

      if (!platformGroups.has(platform)) {
        // This platform exists in cities but not in platforms table - add it anyway
        platformGroups.set(platform, [])
      }

      platformGroups.get(platform)!.push({
        id: region.id,
        plaats: region.plaats,
        postcode: region.postcode ?? ''
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
    console.log(`[DEBUG] Enabled platforms from DB: ${centralPlaces?.filter((cp: PlatformRow) => cp.automation_enabled).length || 0}`)

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

export const GET = withAuth(getHandler)
