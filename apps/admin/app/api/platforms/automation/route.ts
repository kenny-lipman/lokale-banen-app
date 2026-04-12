import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase'

interface PlatformAutomationUpdate {
  platform: string
  automation_enabled: boolean
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
    const requestBody: PlatformAutomationUpdate = await request.json()

    if (!requestBody.platform || typeof requestBody.automation_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body - platform and automation_enabled required' },
        { status: 400 }
      )
    }

    // Update the platforms table
    const { data: updatedPlatform, error: updateError } = await supabase
      .from('platforms')
      .update({ 
        automation_enabled: requestBody.automation_enabled,
        updated_at: new Date().toISOString()
      })
      .eq('regio_platform', requestBody.platform)
      .select('regio_platform, automation_enabled')
      .single()

    if (updateError) {
      console.error('Error updating platform automation:', updateError)
      return NextResponse.json(
        { error: 'Failed to update platform automation settings' },
        { status: 500 }
      )
    }

    if (!updatedPlatform) {
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      platform: updatedPlatform.regio_platform,
      automation_enabled: updatedPlatform.automation_enabled
    })

  } catch (error) {
    console.error('Unexpected error in platform automation API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
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

    // Fetch all platforms with their automation settings
    const { data: platforms, error } = await supabase
      .from('platforms')
      .select('regio_platform, automation_enabled')
      .order('regio_platform', { ascending: true })

    if (error) {
      console.error('Error fetching platform automation settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch platform automation settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      platforms: platforms || [],
      totalCount: platforms?.length || 0
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60'
      }
    })

  } catch (error) {
    console.error('Unexpected error in platform automation API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}