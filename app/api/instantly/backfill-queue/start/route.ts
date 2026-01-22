import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService } from '@/lib/services/instantly-backfill.service';

export const maxDuration = 300; // Allow up to 5 minutes for collection + processing

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const { campaignIds, dryRun = false, batchSize = 25, delayMs = 200, maxLeadsToCollect } = body;

    // Create batch
    const batch = await instantlyBackfillService.createBatch({
      campaignIds,
      dryRun,
      batchSize,
      delayMs,
      maxLeadsToCollect: maxLeadsToCollect ? parseInt(maxLeadsToCollect, 10) : undefined,
    });

    // Start collecting and processing in background
    // This runs async so the API returns immediately
    runBackfillAsync(batch.batch_id).catch((error) => {
      console.error(`Error in backfill for batch ${batch.batch_id}:`, error);
    });

    return NextResponse.json({
      success: true,
      batchId: batch.batch_id,
      message: 'Backfill started. Collecting leads...',
    });
  } catch (error) {
    console.error('Failed to start backfill:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start backfill',
      },
      { status: 500 }
    );
  }
}

/**
 * Run the full backfill process: collect leads, then process them
 */
async function runBackfillAsync(batchId: string): Promise<void> {
  try {
    // Step 1: Collect leads from Instantly
    console.log(`🚀 Starting backfill collection for ${batchId}...`);
    await instantlyBackfillService.collectLeads(batchId);

    // Step 2: Process leads in a loop until complete
    console.log(`🔄 Starting backfill processing for ${batchId}...`);
    let isComplete = false;
    let loopCount = 0;
    const maxLoops = 1000; // Safety limit

    while (!isComplete && loopCount < maxLoops) {
      loopCount++;

      // Check if batch was cancelled or paused
      const batchStatus = await instantlyBackfillService.getBatch(batchId);
      if (!batchStatus) {
        console.log(`❌ Batch ${batchId} not found, stopping`);
        break;
      }

      if (batchStatus.status === 'cancelled') {
        console.log(`⏹️ Batch ${batchId} was cancelled, stopping`);
        break;
      }

      if (batchStatus.status === 'paused') {
        console.log(`⏸️ Batch ${batchId} is paused, stopping processing loop`);
        break;
      }

      if (batchStatus.status === 'completed' || batchStatus.status === 'failed') {
        console.log(`✅ Batch ${batchId} already ${batchStatus.status}`);
        isComplete = true;
        break;
      }

      // Process next batch of leads
      const result = await instantlyBackfillService.processNextBatch(batchId);
      isComplete = result.isComplete;

      if (!isComplete) {
        // Small delay between processing batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (loopCount >= maxLoops) {
      console.warn(`⚠️ Batch ${batchId} reached max loop count (${maxLoops})`);
    }

    console.log(`🎉 Backfill ${batchId} processing complete`);
  } catch (error) {
    console.error(`❌ Error in backfill async process:`, error);
    throw error;
  }
}
