// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { supabaseService } from '@/lib/supabase-service'
import type { Database } from '@/lib/supabase'

// PATCH-payload voor partial platform-updates vanuit de Settings-pagina
// (PlatformAutomationSection + MailerLiteGroupSection).
interface PatchPlatformRequest {
  is_active?: boolean
  instantly_campaign_id?: string | null
  automation_enabled?: boolean
  mailerlite_group_id?: string | null
}

type PlatformsUpdate = Database['public']['Tables']['platforms']['Update']

type Ctx = { params: Promise<{ platform: string }> }

async function patchHandler(
  request: NextRequest,
  auth: AuthResult,
  { params }: Ctx,
) {
  try {
    const supabase = auth.supabase

    const { platform } = await params
    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter is required' }, { status: 400 })
    }

    const body: PatchPlatformRequest = await request.json()

    const updateData: PlatformsUpdate = {
      updated_at: new Date().toISOString(),
    }
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.automation_enabled !== undefined) updateData.automation_enabled = body.automation_enabled
    if (body.instantly_campaign_id !== undefined) {
      updateData.instantly_campaign_id = body.instantly_campaign_id || null
    }
    if (body.mailerlite_group_id !== undefined) {
      updateData.mailerlite_group_id = body.mailerlite_group_id || null
    }

    // Alleen `updated_at` betekent geen velden om te updaten
    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseService.serviceClient
      .from('platforms')
      .update(updateData)
      .eq('regio_platform', platform)
      .select(
        'id, regio_platform, central_place, central_postcode, automation_enabled, is_active, instantly_campaign_id, mailerlite_group_id',
      )
      .single()

    if (updateError) {
      console.error('Error updating platform:', updateError)
      return NextResponse.json({ error: 'Failed to update platform' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: `Platform '${platform}' not found` }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Platform ${platform} updated`,
      platform: updated,
    })
  } catch (error) {
    console.error('Unexpected error in PATCH platform API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const PATCH = withAuth(patchHandler)
