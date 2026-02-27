/**
 * Pipedrive Backfill: Sync unprocessed contacts to Pipedrive
 *
 * Processes contacts that have Instantly data (instantly_synced = true)
 * but no Pipedrive person yet (pipedrive_person_id IS NULL).
 *
 * Uses the full syncLeadToPipedrive() flow which does 7-11 API calls per lead.
 * Process sequentially with rate limiting — max ~60-80 leads per Vercel run (300s timeout).
 *
 * No automatic cron schedule — trigger manually and repeat until remaining = 0.
 *
 * POST /api/cron/sync-contacts-to-pipedrive
 * Body: {
 *   batchSize?: number (default: 50, max: 100)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronMonitoring } from '@/lib/cron-monitor';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';

const MAX_BATCH_SIZE = 100;
const DEFAULT_BATCH_SIZE = 50;

async function syncHandler(request: NextRequest) {
  const startTime = Date.now();

  try {
    let batchSize = DEFAULT_BATCH_SIZE;

    try {
      const body = await request.json();
      if (typeof body.batchSize === 'number' && body.batchSize >= 1 && body.batchSize <= MAX_BATCH_SIZE) {
        batchSize = body.batchSize;
      }
    } catch {
      // No body provided, use defaults
    }

    console.log(`🔄 Starting Pipedrive sync for unprocessed contacts (batch: ${batchSize})`);

    const result = await instantlyPipedriveSyncService.syncUnprocessedContactsToPipedrive(batchSize);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: result.remaining > 0
        ? `Batch complete — ${result.remaining} contacts remaining`
        : 'All eligible contacts synced to Pipedrive',
      ...result,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ Pipedrive sync error:', errorMessage);

    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage, duration: `${duration}ms` },
      { status: 500 }
    );
  }
}

const monitored = withCronMonitoring('sync-contacts-to-pipedrive', '/api/cron/sync-contacts-to-pipedrive');
export const POST = monitored(syncHandler);
