import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

interface AutomationPreferencesResponse {
  preferences: {
    region_id: string;
    automation_enabled: boolean;
  }[];
}

interface UpdateAutomationPreferencesRequest {
  preferences: {
    region_id: string;
    automation_enabled: boolean;
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
    const { data: { user }, error: authError } = await supabaseService.client.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Fetch user's automation preferences with caching
    const { data: preferences, error } = await supabaseService.client
      .from('user_automation_preferences')
      .select('region_id, automation_enabled')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching automation preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch automation preferences' },
        { status: 500 }
      )
    }

    const response: AutomationPreferencesResponse = {
      preferences: preferences || []
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=240' // 2 minutes cache
      }
    })

  } catch (error) {
    console.error('Unexpected error in automation preferences GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    // Parse request body
    const requestBody: UpdateAutomationPreferencesRequest = await request.json()
    
    // Validate request body
    if (!requestBody.preferences || !Array.isArray(requestBody.preferences)) {
      return NextResponse.json(
        { error: 'Invalid request body - preferences array is required' },
        { status: 400 }
      )
    }

    // Validate each preference
    for (const preference of requestBody.preferences) {
      if (!preference.region_id || typeof preference.automation_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid preference format - region_id and automation_enabled are required' },
          { status: 400 }
        )
      }
    }

    // Use the batch upsert function for better performance
    const { error: upsertError } = await supabaseService.client.rpc('upsert_automation_preferences', {
      p_user_id: user.id,
      p_preferences: requestBody.preferences
    })

    if (upsertError) {
      console.error('Error upserting automation preferences:', upsertError)
      return NextResponse.json(
        { error: 'Failed to update automation preferences' },
        { status: 500 }
      )
    }

    // Log the preference change for audit purposes
    console.log(`User ${user.id} updated automation preferences for ${requestBody.preferences.length} regions`)

    return NextResponse.json({ 
      success: true,
      message: 'Automation preferences updated successfully',
      updated_count: requestBody.preferences.length
    })

  } catch (error) {
    console.error('Unexpected error in automation preferences PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 