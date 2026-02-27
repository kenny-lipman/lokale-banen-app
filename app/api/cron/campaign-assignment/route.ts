import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
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
    let chunkSize = 25 // Default chunk size for Vercel timeout safety
    let resumeBatchId: string | undefined
    let platformId: string | undefined
    let orchestrationId: string | undefined

    try {
      const body = await request.json()
      if (body.maxTotal) maxTotal = body.maxTotal
      if (body.maxPerPlatform) maxPerPlatform = body.maxPerPlatform
      if (body.delayBetweenContactsMs) delayBetweenContactsMs = body.delayBetweenContactsMs
      if (body.dryRun !== undefined) dryRun = body.dryRun
      if (body.chunkSize) chunkSize = body.chunkSize
      if (body.resumeBatchId) resumeBatchId = body.resumeBatchId
      if (body.platformId) platformId = body.platformId
      if (body.orchestrationId) orchestrationId = body.orchestrationId
    } catch {
      // No body provided, use settings from database
    }

    // Check for active batch to resume (skipped in platform worker mode)
    const activeBatch = platformId ? null : await automaticCampaignAssignmentService.findActiveBatch()
    const isResume = !!activeBatch || !!resumeBatchId

    console.log(`📊 Configuration: maxTotal=${maxTotal}, maxPerPlatform=${maxPerPlatform}, delay=${delayBetweenContactsMs}ms, chunkSize=${chunkSize}, dryRun=${dryRun}`)
    if (platformId) {
      console.log(`🎯 Platform worker mode: platformId=${platformId}, orchestrationId=${orchestrationId || 'none'}`)
    }
    if (isResume) {
      console.log(`🔄 Resuming active batch: ${activeBatch?.batchId || resumeBatchId}`)
    }

    // Run the daily assignment (with chunked processing)
    const result = await automaticCampaignAssignmentService.runDailyAssignment({
      maxTotal,
      maxPerPlatform,
      delayBetweenContactsMs,
      dryRun,
      chunkSize,
      resumeBatchId,
      platformId,
      orchestrationId
    })

    const duration = Date.now() - startTime
    const hasMoreToProcess = result.stats.processed < result.stats.totalCandidates

    console.log(`✅ Campaign assignment CRON job completed in ${duration}ms`)
    console.log(`📈 Results: ${result.stats.added} added, ${result.stats.skipped} skipped, ${result.stats.errors} errors`)
    if (hasMoreToProcess) {
      console.log(`🔄 ${result.stats.totalCandidates - result.stats.processed} contacts remaining for next run`)
    }

    return NextResponse.json({
      success: true,
      message: result.leadLimitReached
        ? 'Stopped: Instantly lead limit reached'
        : hasMoreToProcess
          ? `Chunk completed (${result.stats.processed}/${result.stats.totalCandidates}). Run again to continue.`
          : 'Campaign assignment completed',
      batchId: result.batchId,
      isResume,
      hasMoreToProcess,
      leadLimitReached: result.leadLimitReached || false,
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

    // Try to get the active batch and update its error status
    try {
      const activeBatch = await automaticCampaignAssignmentService.findActiveBatch()
      if (activeBatch) {
        // Log the error to the batch so frontend can see it
        console.log(`📝 Logging error to batch ${activeBatch.batchId}`)
      }
    } catch (e) {
      console.error('Failed to log error to batch:', e)
    }

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

// Export secured handlers — GET for Vercel Cron, POST for manual triggers with body params
const monitored = withCronMonitoring('campaign-assignment', '/api/cron/campaign-assignment')
export const POST = monitored(campaignAssignmentHandler)
export const GET = monitored(campaignAssignmentHandler)
