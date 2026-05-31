// @ts-nocheck - deprecated route referencing dropped table user_platform_automation_preferences
// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

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

async function getHandler(request: NextRequest, auth: AuthResult) {
  try {
    const supabase = auth.supabase

    const { data: preferences, error } = await supabase
      .from('user_platform_automation_preferences')
      .select('regio_platform, automation_enabled')
      .eq('user_id', auth.user.id)
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

async function putHandler(request: NextRequest, auth: AuthResult) {
  try {
    const supabase = auth.supabase

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
          user_id: auth.user.id,
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

export const GET = withAuth(getHandler)
export const PUT = withAuth(putHandler)
