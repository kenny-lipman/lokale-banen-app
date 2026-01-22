import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export interface CampaignAssignmentSettings {
  id: string
  max_total_contacts: number
  max_per_platform: number
  is_enabled: boolean
  delay_between_contacts_ms: number
  updated_at: string
  updated_by: string | null
}

// Note: Using 'as any' because table types will be generated after migration runs

// GET - Fetch current settings
export async function GET() {
  try {
    const supabase = createServiceRoleClient()

    const { data, error } = await (supabase as any)
      .from('campaign_assignment_settings')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      // If table doesn't exist or no settings, return defaults
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          settings: {
            id: 'default',
            max_total_contacts: 500,
            max_per_platform: 30,
            is_enabled: true,
            delay_between_contacts_ms: 500,
            updated_at: new Date().toISOString(),
            updated_by: null
          } as CampaignAssignmentSettings,
          isDefault: true
        })
      }

      console.error('Error fetching campaign assignment settings:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: data as CampaignAssignmentSettings,
      isDefault: false
    })
  } catch (error) {
    console.error('Unexpected error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { max_total_contacts, max_per_platform, is_enabled, delay_between_contacts_ms } = body

    // Validation
    if (max_total_contacts !== undefined && (typeof max_total_contacts !== 'number' || max_total_contacts < 1 || max_total_contacts > 5000)) {
      return NextResponse.json(
        { success: false, error: 'max_total_contacts must be between 1 and 5000' },
        { status: 400 }
      )
    }

    if (max_per_platform !== undefined && (typeof max_per_platform !== 'number' || max_per_platform < 1 || max_per_platform > 500)) {
      return NextResponse.json(
        { success: false, error: 'max_per_platform must be between 1 and 500' },
        { status: 400 }
      )
    }

    if (delay_between_contacts_ms !== undefined && (typeof delay_between_contacts_ms !== 'number' || delay_between_contacts_ms < 100 || delay_between_contacts_ms > 5000)) {
      return NextResponse.json(
        { success: false, error: 'delay_between_contacts_ms must be between 100 and 5000' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()

    // Build update object with only provided fields
    const updates: Partial<CampaignAssignmentSettings> = {}
    if (max_total_contacts !== undefined) updates.max_total_contacts = max_total_contacts
    if (max_per_platform !== undefined) updates.max_per_platform = max_per_platform
    if (is_enabled !== undefined) updates.is_enabled = is_enabled
    if (delay_between_contacts_ms !== undefined) updates.delay_between_contacts_ms = delay_between_contacts_ms

    // First try to update existing settings
    const { data: existingData } = await (supabase as any)
      .from('campaign_assignment_settings')
      .select('id')
      .limit(1)
      .single()

    if (existingData) {
      // Update existing settings
      const { data, error } = await (supabase as any)
        .from('campaign_assignment_settings')
        .update(updates)
        .eq('id', existingData.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating campaign assignment settings:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to update settings' },
          { status: 500 }
        )
      }

      console.log('📝 Campaign assignment settings updated:', updates)

      return NextResponse.json({
        success: true,
        settings: data as CampaignAssignmentSettings,
        message: 'Settings updated successfully'
      })
    } else {
      // Insert new settings with defaults + updates
      const newSettings = {
        max_total_contacts: max_total_contacts ?? 500,
        max_per_platform: max_per_platform ?? 30,
        is_enabled: is_enabled ?? true,
        delay_between_contacts_ms: delay_between_contacts_ms ?? 500
      }

      const { data, error } = await (supabase as any)
        .from('campaign_assignment_settings')
        .insert(newSettings)
        .select()
        .single()

      if (error) {
        console.error('Error creating campaign assignment settings:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to create settings' },
          { status: 500 }
        )
      }

      console.log('📝 Campaign assignment settings created:', newSettings)

      return NextResponse.json({
        success: true,
        settings: data as CampaignAssignmentSettings,
        message: 'Settings created successfully'
      })
    }
  } catch (error) {
    console.error('Unexpected error updating settings:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
