import { NextRequest, NextResponse } from 'next/server'
import { automaticCampaignAssignmentService } from '@/lib/services/automatic-campaign-assignment.service'

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

    console.log(`📊 Configuration: maxTotal=${maxTotal}, maxPerPlatform=${maxPerPlatform}, delay=${delayBetweenContactsMs}ms, dryRun=${dryRun}`)

    // Run the assignment
    const result = await automaticCampaignAssignmentService.runDailyAssignment({
      maxTotal,
      maxPerPlatform,
      delayBetweenContactsMs,
      dryRun
    })

    const duration = Date.now() - startTime

    console.log(`✅ Manual campaign assignment completed in ${duration}ms`)
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
