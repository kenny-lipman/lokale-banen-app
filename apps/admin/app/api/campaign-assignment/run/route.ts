import { NextRequest, NextResponse } from 'next/server'
import { automaticCampaignAssignmentService } from '@/lib/services/automatic-campaign-assignment.service'

/**
 * POST /api/campaign-assignment/run
 * Manual trigger — delegates to the parallel orchestrator endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    // Build internal URL to orchestrator
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`
    const orchestratorUrl = `${baseUrl}/api/cron/campaign-assignment-parallel`

    // Auth with CRON_SECRET (orchestrator requires it)
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    }

    const response = await fetch(orchestratorUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ dryRun: body.dryRun || false }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { success: false, message: data.message || data.error || 'Orchestrator failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: data.success,
      message: data.message,
      orchestrationId: data.orchestrationId,
      totalCandidates: data.totalCandidates,
      platforms: data.platforms,
      duration: data.duration,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error in manual campaign assignment:', errorMessage)

    return NextResponse.json(
      { success: false, error: 'Internal server error', message: errorMessage },
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
      { success: false, error: 'Internal server error', message: errorMessage },
      { status: 500 }
    )
  }
}
