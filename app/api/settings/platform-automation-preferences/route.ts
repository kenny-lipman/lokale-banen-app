import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

interface PlatformAutomationPreference {
  regio_platform: string
  automation_enabled: boolean
}

interface PlatformPreferencesRequest {
  preferences: PlatformAutomationPreference[]
}

interface PlatformPreferencesResponse {
  preferences: PlatformAutomationPreference[]
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

    const { data: preferences, error } = await supabase
      .from('user_platform_automation_preferences')
      .select('regio_platform, automation_enabled')
      .eq('user_id', user.id)
      .order('regio_platform', { ascending: true })

    if (error) {
      console.error('Error fetching platform preferences:', error)
      return NextResponse.json(
        { error: 'Failed to fetch platform preferences' },
        { status: 500 }
      )
    }

    const response: PlatformPreferencesResponse = {
      preferences: preferences || [],
      totalCount: preferences?.length || 0
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60'
      }
    })

  } catch (error) {
    console.error('Unexpected error in platform preferences API:', error)
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

    // Parse request body
    const requestBody: PlatformPreferencesRequest = await request.json()

    if (!requestBody.preferences || !Array.isArray(requestBody.preferences)) {
      return NextResponse.json(
        { error: 'Invalid request body - preferences array required' },
        { status: 400 }
      )
    }

    // Validate preferences
    for (const pref of requestBody.preferences) {
      if (!pref.regio_platform || typeof pref.automation_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid preference format - regio_platform and automation_enabled required' },
          { status: 400 }
        )
      }
    }

    // Upsert preferences (insert or update)
    const { data: updatedPreferences, error: upsertError } = await supabase
      .from('user_platform_automation_preferences')
      .upsert(
        requestBody.preferences.map(pref => ({
          user_id: user.id,
          regio_platform: pref.regio_platform,
          automation_enabled: pref.automation_enabled
        })),
        { onConflict: 'user_id,regio_platform' }
      )
      .select('regio_platform, automation_enabled')

    if (upsertError) {
      console.error('Error upserting platform preferences:', upsertError)
      return NextResponse.json(
        { error: 'Failed to update platform preferences' },
        { status: 500 }
      )
    }

    const response: PlatformPreferencesResponse = {
      preferences: updatedPreferences || [],
      totalCount: updatedPreferences?.length || 0
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Unexpected error in platform preferences API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 