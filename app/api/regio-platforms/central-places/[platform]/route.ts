import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

// Interface for update request
interface UpdateCentralPlaceRequest {
  central_place: string
  central_postcode?: string
  scraping_priority?: number
  is_active?: boolean
}

// Interface for API response
interface UpdateCentralPlaceResponse {
  success: boolean
  message: string
  centralPlace?: {
    id: string
    regio_platform: string
    central_place: string
    central_postcode?: string
    scraping_priority: number
    is_active: boolean
    updated_at: string
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
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

    // TODO: Add admin role check here when admin system is implemented
    // For now, allow any authenticated user to update central places
    // In production, this should be restricted to admin users only

    const platform = params.platform
    if (!platform) {
      return NextResponse.json(
        { error: 'Platform parameter is required' },
        { status: 400 }
      )
    }

    // Parse request body
    const requestBody: UpdateCentralPlaceRequest = await request.json()

    // Validate required fields
    if (!requestBody.central_place) {
      return NextResponse.json(
        { error: 'central_place is required' },
        { status: 400 }
      )
    }

    // Validate scraping priority if provided
    if (requestBody.scraping_priority !== undefined && 
        (requestBody.scraping_priority < 1 || requestBody.scraping_priority > 10)) {
      return NextResponse.json(
        { error: 'scraping_priority must be between 1 and 10' },
        { status: 400 }
      )
    }

    // Check if the central place exists in the regions table
    const { data: regionExists, error: regionError } = await supabaseService.client
      .from('regions')
      .select('id')
      .eq('regio_platform', platform)
      .eq('plaats', requestBody.central_place)
      .limit(1)

    if (regionError) {
      console.error('Error checking region existence:', regionError)
      return NextResponse.json(
        { error: 'Failed to validate central place' },
        { status: 500 }
      )
    }

    if (!regionExists || regionExists.length === 0) {
      return NextResponse.json(
        { error: `Central place '${requestBody.central_place}' not found in platform '${platform}'` },
        { status: 400 }
      )
    }

    // Update the central place
    const updateData: Partial<UpdateCentralPlaceRequest> = {
      central_place: requestBody.central_place,
      updated_at: new Date().toISOString()
    }

    if (requestBody.central_postcode !== undefined) {
      updateData.central_postcode = requestBody.central_postcode
    }
    if (requestBody.scraping_priority !== undefined) {
      updateData.scraping_priority = requestBody.scraping_priority
    }
    if (requestBody.is_active !== undefined) {
      updateData.is_active = requestBody.is_active
    }

    const { data: updatedCentralPlace, error: updateError } = await supabaseService.client
      .from('regio_platform_central_places')
      .update(updateData)
      .eq('regio_platform', platform)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating central place:', updateError)
      return NextResponse.json(
        { error: 'Failed to update central place' },
        { status: 500 }
      )
    }

    if (!updatedCentralPlace) {
      return NextResponse.json(
        { error: `Central place for platform '${platform}' not found` },
        { status: 404 }
      )
    }

    const response: UpdateCentralPlaceResponse = {
      success: true,
      message: `Central place for ${platform} updated successfully`,
      centralPlace: {
        id: updatedCentralPlace.id,
        regio_platform: updatedCentralPlace.regio_platform,
        central_place: updatedCentralPlace.central_place,
        central_postcode: updatedCentralPlace.central_postcode,
        scraping_priority: updatedCentralPlace.scraping_priority,
        is_active: updatedCentralPlace.is_active,
        updated_at: updatedCentralPlace.updated_at
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Unexpected error in update central place API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 