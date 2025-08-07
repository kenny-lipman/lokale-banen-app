import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { cacheService } from '@/lib/cache-service'

export async function POST(request: NextRequest) {
  try {
    const { 
      event_type, 
      campaign_id, 
      campaign_name, 
      contact_count, 
      success_count, 
      failed_count, 
      user_id, 
      session_id,
      modal_shown,
      modal_confirmed,
      processing_time_ms,
      error_codes,
      metadata 
    } = await request.json()

    // Validate required fields
    if (!event_type || !['campaign_addition_attempt', 'modal_shown', 'modal_confirmed', 'api_error'].includes(event_type)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid event type',
        code: 'INVALID_EVENT_TYPE'
      }, { status: 400 })
    }

    const supabase = createClient()

    // Log the analytics event
    const { data: analyticsData, error: analyticsError } = await supabase
      .from('campaign_addition_analytics')
      .insert({
        event_type,
        campaign_id,
        campaign_name,
        contact_count: contact_count || 0,
        success_count: success_count || 0,
        failed_count: failed_count || 0,
        user_id: user_id || null,
        session_id: session_id || null,
        modal_shown: modal_shown || false,
        modal_confirmed: modal_confirmed || false,
        processing_time_ms: processing_time_ms || null,
        error_codes: error_codes || [],
        metadata: metadata || {},
        timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (analyticsError) {
      console.error('Error logging analytics:', analyticsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to log analytics event',
        code: 'ANALYTICS_LOG_ERROR'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        analytics_id: analyticsData.id,
        event_type,
        timestamp: analyticsData.timestamp
      }
    })

  } catch (error) {
    console.error('Error in campaign addition analytics:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const campaignId = searchParams.get('campaign_id')
    const eventType = searchParams.get('event_type')

    const supabase = createClient()

    // Build query for analytics data
    let query = supabase
      .from('campaign_addition_analytics')
      .select('*')
      .order('timestamp', { ascending: false })

    // Apply filters
    if (startDate) {
      query = query.gte('timestamp', startDate)
    }
    if (endDate) {
      query = query.lte('timestamp', endDate)
    }
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    const { data: analytics, error } = await query

    if (error) {
      console.error('Error fetching analytics:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch analytics data',
        code: 'ANALYTICS_FETCH_ERROR'
      }, { status: 500 })
    }

    // Calculate summary statistics
    const totalEvents = analytics?.length || 0
    const campaignAdditions = analytics?.filter(a => a.event_type === 'campaign_addition_attempt') || []
    const modalShown = analytics?.filter(a => a.event_type === 'modal_shown') || []
    const modalConfirmed = analytics?.filter(a => a.event_type === 'modal_confirmed') || []
    const apiErrors = analytics?.filter(a => a.event_type === 'api_error') || []

    const summary = {
      total_events: totalEvents,
      campaign_additions: {
        total: campaignAdditions.length,
        successful: campaignAdditions.filter(a => a.success_count > 0).length,
        failed: campaignAdditions.filter(a => a.failed_count > 0).length,
        total_contacts_processed: campaignAdditions.reduce((sum, a) => sum + (a.contact_count || 0), 0),
        total_contacts_successful: campaignAdditions.reduce((sum, a) => sum + (a.success_count || 0), 0),
        total_contacts_failed: campaignAdditions.reduce((sum, a) => sum + (a.failed_count || 0), 0),
        average_processing_time: campaignAdditions.length > 0 
          ? campaignAdditions.reduce((sum, a) => sum + (a.processing_time_ms || 0), 0) / campaignAdditions.length 
          : 0
      },
      modal_usage: {
        shown: modalShown.length,
        confirmed: modalConfirmed.length,
        confirmation_rate: modalShown.length > 0 ? (modalConfirmed.length / modalShown.length) * 100 : 0
      },
      errors: {
        total: apiErrors.length,
        by_code: apiErrors.reduce((acc, error) => {
          const codes = error.error_codes || []
          codes.forEach(code => {
            acc[code] = (acc[code] || 0) + 1
          })
          return acc
        }, {} as Record<string, number>)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        analytics,
        summary,
        filters: {
          start_date: startDate,
          end_date: endDate,
          campaign_id: campaignId,
          event_type: eventType
        }
      }
    })

  } catch (error) {
    console.error('Error fetching campaign addition analytics:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
} 