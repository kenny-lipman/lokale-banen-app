import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

// Interface for central place data
interface CentralPlace {
  id: string
  regio_platform: string
  central_place: string
  central_postcode?: string
  scraping_priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// Interface for API response
interface CentralPlacesResponse {
  centralPlaces: CentralPlace[]
  totalCount: number
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
    const { data: { user }, error: authError } = await supabaseService.client.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Fetch central places with caching headers
    const { data: centralPlaces, error } = await supabaseService.client
      .from('regio_platform_central_places')
      .select('*')
      .eq('is_active', true)
      .order('regio_platform', { ascending: true })

    if (error) {
      console.error('Error fetching central places:', error)
      return NextResponse.json(
        { error: 'Failed to fetch central places' },
        { status: 500 }
      )
    }

    const response: CentralPlacesResponse = {
      centralPlaces: centralPlaces || [],
      totalCount: centralPlaces?.length || 0
    }

    // Add caching headers for performance
    const responseHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=600' // Cache for 5 minutes client, 10 minutes CDN
    })

    return NextResponse.json(response, { headers: responseHeaders })
  } catch (error) {
    console.error('Unexpected error in central places API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 