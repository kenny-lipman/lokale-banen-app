/**
 * Pipedrive Backfill Cron Endpoint
 *
 * Syncs contacts with postal codes to Pipedrive in small batches.
 * Runs every 15 minutes, processes 18 contacts per run to stay within
 * Pipedrive's daily API token budget (450k tokens/day).
 *
 * Budget: ~170 tokens/contact × 18 contacts × 96 runs/day = ~1,728 contacts/day
 * Expected completion: ~3.5 days for ~6,000 contacts
 *
 * Automatically stops when daily budget is exhausted (429 with Retry-After > 60s)
 * and resumes on the next run after midnight budget reset.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service'

const BATCH_SIZE = 18

async function pipedriveBackfillHandler(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Allow batch size override via request body
    let batchSize = BATCH_SIZE
    try {
      const body = await request.json()
      if (body.batchSize && typeof body.batchSize === 'number') {
        batchSize = Math.min(body.batchSize, 50) // Cap at 50 for safety
      }
    } catch {
      // No body or invalid JSON — use default batch size
    }

    console.log(`🔄 Starting Pipedrive backfill CRON job (batch: ${batchSize})`)

    const result = await instantlyPipedriveSyncService.syncUnprocessedContactsToPipedrive(batchSize, {
      requirePostalCode: true,
      includeBounced: false,
    })

    const duration = Date.now() - startTime

    const message = result.dailyLimitReached
      ? `Daily token budget reached after ${result.synced} synced, will resume next run`
      : result.totalEligible === 0
        ? 'No contacts remaining to sync — backfill complete. Remove this cron from vercel.json.'
        : `Synced ${result.synced} contacts (${result.remaining} remaining)`

    if (result.totalEligible === 0) {
      console.log(`🏁 BACKFILL COMPLETE: All contacts have been synced to Pipedrive. Remove /api/cron/pipedrive-backfill from vercel.json to stop unnecessary runs.`)
    }

    console.log(`✅ Pipedrive backfill completed in ${duration}ms: ${message}`)

    return NextResponse.json({
      success: true,
      message,
      synced: result.synced,
      skipped: result.skipped,
      errors: result.errors,
      remaining: result.remaining,
      totalEligible: result.totalEligible,
      dailyLimitReached: result.dailyLimitReached,
      duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error in Pipedrive backfill CRON job:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      code: 'PIPEDRIVE_BACKFILL_FAILED',
      duration: Date.now() - startTime,
    }, { status: 500 })
  }
}

const monitored = withCronMonitoring('pipedrive-backfill', '/api/cron/pipedrive-backfill')
export const GET = monitored(pipedriveBackfillHandler)
export const POST = monitored(pipedriveBackfillHandler)
