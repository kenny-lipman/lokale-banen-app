import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService } from '@/lib/services/instantly-backfill.service';

export const maxDuration = 60; // Allow up to 60 seconds for processing

/**
 * Cron worker endpoint for processing backfill batches
 *
 * This endpoint is designed to be called by a cron job (e.g., every minute).
 * It processes one batch of leads from any active backfill.
 *
 * Rate limiting strategy:
 * - Processes 25 leads per batch
 * - 200ms delay between leads
 * - Cron runs every minute
 * - Result: ~120 leads/minute (well within Instantly's rate limits)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET_KEY;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find active batch to process
    const batches = await instantlyBackfillService.listBatches({
      status: 'processing',
      limit: 1,
    });

    if (batches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active batches to process',
        processed: 0,
      });
    }

    const batch = batches[0];
    console.log(`🔄 Processing batch ${batch.batch_id}...`);

    // Process next batch of leads
    const result = await instantlyBackfillService.processNextBatch(batch.batch_id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Backfill worker error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Worker failed',
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
