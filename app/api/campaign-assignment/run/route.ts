import { NextRequest, NextResponse } from 'next/server'
import { automaticCampaignAssignmentService } from '@/lib/services/automatic-campaign-assignment.service'

// Helper to trigger the next chunk via internal fetch
async function triggerNextChunk(baseUrl: string, params: {
  maxTotal: number
  maxPerPlatform: number
  delayBetweenContactsMs: number
  dryRun: boolean
  chunkSize: number
  batchId: string
}): Promise<void> {
  try {
    // Use a fire-and-forget approach - don't await the response
    // This prevents the current request from timing out while waiting
    fetch(`${baseUrl}/api/campaign-assignment/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        resumeBatchId: params.batchId,
        autoContinue: true
      })
    }).catch(err => {
      console.error('Failed to trigger next chunk:', err)
    })

    console.log(`🔄 Triggered next chunk for batch ${params.batchId}`)
  } catch (error) {
    console.error('Error triggering next chunk:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now()
    console.log(`🚀 Manual campaign assignment triggered at ${new Date().toISOString()}`)

    // Fetch settings from database as defaults
    const settings = await automaticCampaignAssignmentService.getSettings()

    // Parse parameters from request body (overrides settings)
    const body = await request.json().catch(() => ({}))
    const maxTotal = body.maxTotal || settings.max_total_contacts
    const maxPerPlatform = body.maxPerPlatform || settings.max_per_platform
    const delayBetweenContactsMs = body.delayBetweenContactsMs || settings.delay_between_contacts_ms
    const dryRun = body.dryRun || false
    const chunkSize = body.chunkSize || 25
    const resumeBatchId = body.resumeBatchId
    const autoContinue = body.autoContinue !== false // Default to true

    console.log(`📊 Configuration: maxTotal=${maxTotal}, maxPerPlatform=${maxPerPlatform}, delay=${delayBetweenContactsMs}ms, chunkSize=${chunkSize}, dryRun=${dryRun}, autoContinue=${autoContinue}`)

    // Run the assignment
    const result = await automaticCampaignAssignmentService.runDailyAssignment({
      maxTotal,
      maxPerPlatform,
      delayBetweenContactsMs,
      dryRun,
      chunkSize,
      resumeBatchId
    })

    const duration = Date.now() - startTime
    const hasMoreToProcess = result.stats.processed < result.stats.totalCandidates

    console.log(`✅ Manual campaign assignment chunk completed in ${duration}ms`)
    console.log(`📈 Results: ${result.stats.added} added, ${result.stats.skipped} skipped, ${result.stats.errors} errors`)

    // Auto-continue: trigger next chunk if there's more to process
    if (hasMoreToProcess && autoContinue && result.status !== 'failed') {
      console.log(`🔄 ${result.stats.totalCandidates - result.stats.processed} contacts remaining - triggering next chunk...`)

      // Get the base URL from the request
      const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`

      // Trigger next chunk asynchronously (fire-and-forget)
      triggerNextChunk(baseUrl, {
        maxTotal,
        maxPerPlatform,
        delayBetweenContactsMs,
        dryRun,
        chunkSize,
        batchId: result.batchId
      })
    }

    return NextResponse.json({
      success: true,
      message: hasMoreToProcess
        ? `Chunk completed (${result.stats.processed}/${result.stats.totalCandidates}). ${autoContinue ? 'Next chunk triggered.' : 'Run again to continue.'}`
        : 'Campaign assignment completed',
      batchId: result.batchId,
      hasMoreToProcess,
      autoContinue,
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
    console.error('❌ Error in manual campaign assignment:', errorMessage)

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

// GET endpoint to preview candidates without running assignment
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const maxTotal = parseInt(searchParams.get('maxTotal') || '50')
    const maxPerPlatform = parseInt(searchParams.get('maxPerPlatform') || '10')

    console.log(`📋 Previewing campaign assignment candidates`)

    // Get candidate contacts
    const candidates = await automaticCampaignAssignmentService.getCandidateContacts(maxTotal, maxPerPlatform)

    // Group by platform for overview
    const platformSummary: Record<string, number> = {}
    candidates.forEach(c => {
      const platform = c.platform_name || 'Unknown'
      platformSummary[platform] = (platformSummary[platform] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      totalCandidates: candidates.length,
      platformSummary,
      candidates: candidates.slice(0, 20) // Return first 20 for preview
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error previewing candidates:', errorMessage)

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
