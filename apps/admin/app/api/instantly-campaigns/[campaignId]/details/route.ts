import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache-service'

const INSTANTLY_API_KEY = "ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw=="

export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params

    // Validate campaign ID
    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Valid campaign ID is required',
        code: 'INVALID_CAMPAIGN_ID'
      }, { status: 400 })
    }

    // Check cache first (cache for 5 minutes)
    const cacheKey = `campaign_details:${campaignId}`
    const cachedData = cacheService.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true
      })
    }

    // Fetch campaign details from Instantly API
    const response = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${INSTANTLY_API_KEY}`,
        "Content-Type": "application/json"
      }
    })

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({
          success: false,
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND',
          campaignId
        }, { status: 404 })
      } else if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          success: false,
          error: 'Access denied to campaign',
          code: 'CAMPAIGN_ACCESS_DENIED',
          campaignId
        }, { status: 403 })
      } else {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch campaign details',
          code: 'API_ERROR',
          status: response.status
        }, { status: 500 })
      }
    }

    const campaignData = await response.json()

    // Validate campaign data
    if (!campaignData || !campaignData.id) {
      return NextResponse.json({
        success: false,
        error: 'Invalid campaign data received',
        code: 'INVALID_CAMPAIGN_DATA'
      }, { status: 500 })
    }

    // Transform and structure the response
    const campaignDetails = {
      id: campaignData.id,
      name: campaignData.name || '',
      description: campaignData.description || '',
      status: campaignData.status || 'unknown',
      type: campaignData.type || 'unknown',
      created_at: campaignData.created_at,
      updated_at: campaignData.updated_at,
      settings: campaignData.settings || {},
      metadata: {
        total_leads: campaignData.total_leads || 0,
        active_leads: campaignData.active_leads || 0,
        completed_leads: campaignData.completed_leads || 0,
        failed_leads: campaignData.failed_leads || 0,
        paused_leads: campaignData.paused_leads || 0
      }
    }

    // Cache the result for 5 minutes
    cacheService.set(cacheKey, campaignDetails, 300)

    return NextResponse.json({
      success: true,
      data: campaignDetails,
      cached: false
    })

  } catch (error) {
    console.error('Error fetching campaign details:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
} 