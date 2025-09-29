import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

interface SyncResult {
  created: Array<{
    regio_platform: string
    central_place: string
    central_postcode?: string
  }>
  skipped: string[]
  errors: string[]
}

async function syncCentralPlacesHandler(request: NextRequest, authResult: AuthResult) {
  try {
    const { user } = authResult

    // Get all unique regio_platforms from regions
    const uniquePlatforms = await supabaseService.getUniqueRegioPlatforms()
    
    // Get existing central places
    const { data: existingCentralPlaces, error: existingError } = await authResult.supabase
      .from('regio_platform_central_places')
      .select('regio_platform')

    if (existingError) {
      console.error('Error fetching existing central places:', existingError)
      return NextResponse.json(
        { error: 'Failed to fetch existing central places' },
        { status: 500 }
      )
    }

    const existingPlatforms = new Set(
      existingCentralPlaces?.map(cp => cp.regio_platform) || []
    )

    // Find missing platforms
    const missingPlatforms = uniquePlatforms.filter(
      platform => !existingPlatforms.has(platform)
    )

    const result: SyncResult = {
      created: [],
      skipped: [],
      errors: []
    }

    // Create central places for missing platforms
    for (const platform of missingPlatforms) {
      try {
        // Extract city name from platform (e.g., "HaagseBanen" -> "Den Haag")
        const centralPlace = extractCityFromPlatform(platform)
        
        const { data: insertedData, error: insertError } = await authResult.supabase
          .from('regio_platform_central_places')
          .insert({
            regio_platform: platform,
            central_place: centralPlace,
            central_postcode: null, // To be filled in manually later
            scraping_priority: 1,
            is_active: true
          })
          .select()

        if (insertError) {
          console.error(`Error creating central place for ${platform}:`, insertError)
          result.errors.push(`${platform}: ${insertError.message}`)
        } else {
          result.created.push({
            regio_platform: platform,
            central_place: centralPlace
          })
        }
      } catch (error) {
        console.error(`Unexpected error for ${platform}:`, error)
        result.errors.push(`${platform}: Unexpected error`)
      }
    }

    // Mark existing platforms as skipped
    result.skipped = Array.from(existingPlatforms).filter(
      (platform): platform is string => uniquePlatforms.includes(platform)
    )

    return NextResponse.json({
      success: true,
      message: `Sync completed. Created ${result.created.length}, skipped ${result.skipped.length}, errors ${result.errors.length}`,
      result
    })

  } catch (error) {
    console.error('Unexpected error in sync central places API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(syncCentralPlacesHandler)

/**
 * Extract city name from platform name
 * Examples: HaagseBanen -> Den Haag, AmsterdamseBanen -> Amsterdam
 */
function extractCityFromPlatform(platform: string): string {
  // Common mappings for special cases
  const cityMappings: Record<string, string> = {
    'HaagseBanen': 'Den Haag',
    'VoornseBanen': 'Voorburg',
    'DrechtseBanen': 'Dordrecht'
  }

  if (cityMappings[platform]) {
    return cityMappings[platform]
  }

  // For regular patterns like "AmsterdamseBanen" -> "Amsterdam"
  const match = platform.match(/^(.+?)seBanen$/i)
  if (match) {
    let cityName = match[1]
    
    // Capitalize first letter
    cityName = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase()
    
    return cityName
  }

  // Fallback: use platform name as-is
  return platform
}