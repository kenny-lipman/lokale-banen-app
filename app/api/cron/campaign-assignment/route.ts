import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { automaticCampaignAssignmentService } from '@/lib/services/automatic-campaign-assignment.service'

async function campaignAssignmentHandler(request: NextRequest) {
  try {
    const startTime = Date.now()
    console.log(`🚀 Starting automatic campaign assignment CRON job at ${new Date().toISOString()}`)

    // Fetch settings from database
    const settings = await automaticCampaignAssignmentService.getSettings()

    // Check if assignment is enabled
    if (!settings.is_enabled) {
      console.log('⏸️ Campaign assignment is disabled in settings')
      return NextResponse.json({
        success: true,
        message: 'Campaign assignment is disabled',
        skipped: true
      })
    }

    // Parse optional overrides from request body (for manual triggers)
    let maxTotal = settings.max_total_contacts
    let maxPerPlatform = settings.max_per_platform
    let delayBetweenContactsMs = settings.delay_between_contacts_ms
    let dryRun = false

    try {
      const body = await request.json()
      if (body.maxTotal) maxTotal = body.maxTotal
      if (body.maxPerPlatform) maxPerPlatform = body.maxPerPlatform
      if (body.delayBetweenContactsMs) delayBetweenContactsMs = body.delayBetweenContactsMs
      if (body.dryRun !== undefined) dryRun = body.dryRun
    } catch {
      // No body provided, use settings from database
    }

    console.log(`📊 Configuration: maxTotal=${maxTotal}, maxPerPlatform=${maxPerPlatform}, delay=${delayBetweenContactsMs}ms, dryRun=${dryRun}`)

    // Run the daily assignment
    const result = await automaticCampaignAssignmentService.runDailyAssignment({
      maxTotal,
      maxPerPlatform,
      delayBetweenContactsMs,
      dryRun
    })

    const duration = Date.now() - startTime

    console.log(`✅ Campaign assignment CRON job completed in ${duration}ms`)
    console.log(`📈 Results: ${result.stats.added} added, ${result.stats.skipped} skipped, ${result.stats.errors} errors`)

    return NextResponse.json({
      success: true,
      message: 'Campaign assignment completed',
      batchId: result.batchId,
      stats: {
        totalCandidates: result.stats.totalCandidates,
        processed: result.stats.processed,
        added: result.stats.added,
        skipped: result.stats.skipped,
        errors: result.stats.errors
      },
      platformStats: result.stats.platformStats,
      duration
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Unexpected error in campaign assignment CRON job:', errorMessage)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
async function healthHandler(_request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'campaign-assignment-cron'
  })
}

// Export secured handlers
export const POST = withCronAuth(campaignAssignmentHandler)
export const GET = withCronAuth(healthHandler)
