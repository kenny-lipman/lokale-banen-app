import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { contactId, campaignId, campaignName } = await request.json()

    if (!contactId || !campaignId) {
      return NextResponse.json(
        { success: false, error: 'Contact ID and Campaign ID are required' },
        { status: 400 }
      )
    }

    // Update the contact with campaign information
    const { data, error } = await supabase
      .from('contacts')
      .update({
        campaign_id: campaignId,
        campaign_name: campaignName || null
      })
      .eq('id', contactId)
      .select()

    if (error) {
      console.error('Error linking campaign to contact:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to link campaign to contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data[0]
    })

  } catch (error) {
    console.error('Error in link campaign API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
} 