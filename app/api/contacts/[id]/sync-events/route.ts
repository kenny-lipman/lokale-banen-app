import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params

    // First get the contact's email
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('email')
      .eq('id', contactId)
      .single()

    if (contactError || !contact?.email) {
      return NextResponse.json(
        { success: false, error: 'Contact not found or has no email' },
        { status: 404 }
      )
    }

    // Fetch sync events from instantly_pipedrive_syncs table
    const { data: syncEvents, error: syncError } = await supabase
      .from('instantly_pipedrive_syncs')
      .select(`
        id,
        event_type,
        instantly_campaign_name,
        instantly_campaign_id,
        pipedrive_org_name,
        pipedrive_org_id,
        pipedrive_person_id,
        has_reply,
        reply_sentiment,
        sync_success,
        sync_error,
        synced_at,
        created_at,
        instantly_event_at,
        status_prospect_set,
        org_created,
        person_created
      `)
      .eq('instantly_lead_email', contact.email)
      .order('created_at', { ascending: false })
      .limit(50)

    if (syncError) {
      console.error('Error fetching sync events:', syncError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sync events' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: syncEvents || []
    })

  } catch (error) {
    console.error('Error in sync-events endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
