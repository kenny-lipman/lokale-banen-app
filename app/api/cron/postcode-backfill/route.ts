/**
 * Postcode Backfill Cron Endpoint
 *
 * Autonomous system for enriching company postal codes using Nominatim geocoding.
 * Runs every 2 minutes via pg_cron, processes 50 companies per run.
 *
 * Priority Queue:
 * 1. Companies already in Pipedrive (fix hoofddomein/subdomeinen)
 * 2. Companies with contacts in active Instantly campaigns
 * 3. All other companies without postal codes
 *
 * Rate limit: 1 request per second to Nominatim (enforced by GeocodingService)
 *
 * Throughput: 50 companies × 30 runs/hour = 1,500/hour = 36,000/day
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { postcodeBackfillService } from '@/lib/services/postcode-backfill.service'

// Batch size - 50 companies per run to stay within Vercel timeout
const BATCH_SIZE = 50

async function postcodeBackfillHandler(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log(`🔄 Starting postcode backfill CRON job at ${new Date().toISOString()}`)

    // Process batch
    const result = await postcodeBackfillService.processBatch(BATCH_SIZE)

    const duration = Date.now() - startTime

    console.log(`✅ Postcode backfill CRON job completed in ${duration}ms`)
    console.log(`📈 Results: ${result.enriched} enriched, ${result.failed} failed, ${result.skipped} skipped, ${result.pipedriveUpdated} Pipedrive updated`)

    return NextResponse.json({
      success: true,
      message: 'Postcode backfill completed',
      data: {
        processed: result.processed,
        enriched: result.enriched,
        failed: result.failed,
        skipped: result.skipped,
        pipedriveUpdated: result.pipedriveUpdated,
        errors: result.errors.slice(0, 10) // Return first 10 errors
      },
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error in postcode backfill CRON job:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      code: 'POSTCODE_BACKFILL_FAILED',
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

async function healthCheckHandler(_request: NextRequest) {
  try {
    // Get statistics
    const stats = await postcodeBackfillService.getStats()

    return NextResponse.json({
      status: 'healthy',
      service: 'postcode-backfill',
      stats: {
        total: stats.total,
        withPostcode: stats.withPostcode,
        withoutPostcode: stats.withoutPostcode,
        pipedriveWithoutPostcode: stats.pipedriveWithoutPostcode,
        campaignWithoutPostcode: stats.campaignWithoutPostcode,
        geocodedToday: stats.geocodedToday,
        failedToday: stats.failedToday,
        progress: stats.total > 0
          ? `${((stats.withPostcode / stats.total) * 100).toFixed(1)}%`
          : '0%'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json({
      status: 'error',
      service: 'postcode-backfill',
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// GET for Vercel Cron, POST for manual triggers
export const POST = withCronAuth(postcodeBackfillHandler)
export const GET = withCronAuth(postcodeBackfillHandler)
