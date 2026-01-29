import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'
import { withCronAuth } from '@/lib/auth-middleware'

// Environment variable check
const DAILY_SCRAPE_WEBHOOK_URL = process.env.DAILY_SCRAPE_WEBHOOK_URL

if (!DAILY_SCRAPE_WEBHOOK_URL) {
  console.error('❌ DAILY_SCRAPE_WEBHOOK_URL not configured')
}

interface DailyScrapePlatform {
  regio_platform: string;
  central_place: string;
  region_id?: string;
}

// Function to trigger daily scrape webhook for a single platform
const triggerDailyScrapeWebhook = async (platform: string, centralPlace: string, regionId?: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const webhookUrl = process.env.DAILY_SCRAPE_WEBHOOK_URL
    
    if (!webhookUrl) {
      throw new Error('DAILY_SCRAPE_WEBHOOK_URL not configured')
    }

    const payload: any = {
      location: centralPlace
    }

    // Add region_id to payload if available
    if (regionId) {
      payload.region_id = regionId
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Lokale-Banen-DailyScrape/1.0'
      },
      body: JSON.stringify(payload)
    })

    if (response.status !== 200) {
      const errorText = await response.text()
      throw new Error(`Daily scrape webhook failed: ${response.status} - ${errorText}`)
    }

    console.log(`✅ Successfully triggered daily scrape for platform: ${platform} (${centralPlace})${regionId ? ` with region_id: ${regionId}` : ''}`)
    return { success: true }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ Failed to trigger daily scrape for platform ${platform}:`, errorMessage)
    return { success: false, error: errorMessage }
  }
}



// Function to process daily scrape triggers for each platform individually
const processDailyScrapeTriggers = async (platforms: DailyScrapePlatform[]): Promise<{ success: number; failed: number; errors: string[] }> => {
  let successCount = 0
  let failedCount = 0
  const errors: string[] = []

  console.log(`🚀 Starting daily scrape for ${platforms.length} platforms`)

  // Process each platform individually (no batching needed for 25 max platforms)
  for (const platform of platforms) {
    console.log(`📡 Processing platform: ${platform.regio_platform}`)
    
    const result = await triggerDailyScrapeWebhook(platform.regio_platform, platform.central_place, platform.region_id)
    
    if (result.success) {
      successCount++
    } else {
      failedCount++
      if (result.error) {
        errors.push(`${platform.regio_platform}: ${result.error}`)
      }
    }

    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return { success: successCount, failed: failedCount, errors }
}

async function cronTriggerHandler(request: NextRequest) {
  try {
    // Authentication is handled by withCronAuth wrapper

    const supabase = createServiceRoleClient()
    const startTime = Date.now()

    console.log(`🕐 Starting daily scrape CRON job at ${new Date().toISOString()}`)

    // Fetch all enabled and active platforms with their central places
    const { data: enabledPlatforms, error } = await supabase
      .from('platforms')
      .select('id, regio_platform, central_place')
      .eq('automation_enabled', true)
      .eq('is_active', true)
      .not('central_place', 'is', null)

    if (error) {
      console.error('❌ Error fetching enabled platforms:', error)
      return NextResponse.json(
        { error: 'Failed to fetch enabled platforms' },
        { status: 500 }
      )
    }

    if (!enabledPlatforms || enabledPlatforms.length === 0) {
      console.log('ℹ️ No enabled platforms found for automation')
      return NextResponse.json({
        success: true,
        message: 'No enabled platforms found',
        processed: 0,
        duration: Date.now() - startTime
      })
    }

    console.log(`📊 Found ${enabledPlatforms.length} enabled platforms for automation`)

    // Map platforms to the expected format
    const dailyScrapePlatforms: DailyScrapePlatform[] = enabledPlatforms.map(platform => ({
      regio_platform: platform.regio_platform,
      central_place: platform.central_place,
      region_id: platform.id
    }))

    // Process all daily scrape platforms
    const results = await processDailyScrapeTriggers(dailyScrapePlatforms)
    const duration = Date.now() - startTime

    console.log(`✅ Daily scrape CRON job completed in ${duration}ms`)
    console.log(`📈 Results: ${results.success} successful, ${results.failed} failed`)

    if (results.errors.length > 0) {
      console.error('❌ Errors encountered:', results.errors.slice(0, 10)) // Log first 10 errors
    }

    return NextResponse.json({
      success: true,
      message: 'Daily scrape CRON job completed',
      processed: dailyScrapePlatforms.length,
      successful: results.success,
      failed: results.failed,
      duration,
      errors: results.errors.slice(0, 10) // Return first 10 errors
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Unexpected error in daily scrape CRON job:', errorMessage)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

// Health check endpoint for CRON monitoring (also secured)
async function cronHealthHandler(_request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'automation-cron'
  })
}

// Export secured handlers - POST for cron job trigger, GET for health check
export const POST = withCronAuth(cronTriggerHandler)
export const GET = withCronAuth(cronHealthHandler)