import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { automaticCampaignAssignmentService } from '@/lib/services/automatic-campaign-assignment.service'

async function parallelAssignmentHandler(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. Check settings
    const settings = await automaticCampaignAssignmentService.getSettings()
    if (!settings.is_enabled) {
      return NextResponse.json({
        success: true,
        message: 'Campaign assignment is disabled',
        skipped: true
      })
    }

    // 2. Parse options
    let dryRun = false
    try {
      const body = await request.json()
      if (body.dryRun !== undefined) dryRun = body.dryRun
    } catch { /* No body provided */ }

    // 3. Get candidates grouped by platform
    const platforms = await automaticCampaignAssignmentService.getGroupedCandidatesByPlatform(
      settings.max_total_contacts,
      settings.max_per_platform
    )

    if (platforms.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No candidates found',
        platforms: []
      })
    }

    // 4. Generate orchestration ID for grouping batches
    const orchestrationId = `orch_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 8)}`

    // 5. Determine worker URL
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const workerUrl = `${baseUrl}/api/cron/campaign-assignment`

    // 6. Auth header (same CRON_SECRET)
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(cronSecret ? { 'x-api-key': cronSecret } : {})
    }

    const totalCandidates = platforms.reduce((sum, p) => sum + p.candidateCount, 0)
    console.log(`🚀 Orchestrating parallel campaign assignment: ${platforms.length} platforms, ${totalCandidates} candidates, orchestrationId=${orchestrationId}`)

    // 7. Trigger workers per platform (fire-and-forget with short timeout)
    const results = await Promise.allSettled(
      platforms.map(async (platform) => {
        try {
          const response = await fetch(workerUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              platformId: platform.platformId,
              orchestrationId,
              dryRun,
              maxPerPlatform: settings.max_per_platform,
              delayBetweenContactsMs: settings.delay_between_contacts_ms,
            }),
            signal: AbortSignal.timeout(10_000), // 10s — enough to dispatch the request
          })
          return {
            platformId: platform.platformId,
            platformName: platform.platformName,
            status: 'triggered' as const,
            httpStatus: response.status
          }
        } catch {
          // Timeout expected (worker takes >10s) — request WAS sent
          return {
            platformId: platform.platformId,
            platformName: platform.platformName,
            status: 'triggered' as const
          }
        }
      })
    )

    const triggered = results.map((r, i) => ({
      ...platforms[i],
      ...(r.status === 'fulfilled' ? r.value : { status: 'trigger_failed' as const })
    }))

    const duration = Date.now() - startTime

    console.log(`✅ Orchestrator completed in ${duration}ms: ${platforms.length} workers triggered`)

    return NextResponse.json({
      success: true,
      message: `Triggered ${platforms.length} platform workers`,
      orchestrationId,
      dryRun,
      totalCandidates,
      platforms: triggered,
      duration: `${duration}ms`
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Parallel assignment error:', errorMessage)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        duration: `${Date.now() - startTime}ms`
      },
      { status: 500 }
    )
  }
}

const monitored = withCronMonitoring('campaign-assignment-parallel', '/api/cron/campaign-assignment-parallel')
export const POST = monitored(parallelAssignmentHandler)
