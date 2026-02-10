/**
 * Cron Job: Cleanup Instantly Leads
 *
 * Removes leads from Instantly that had campaign_completed more than 10 days ago.
 * This gives late responders a chance to reply before being removed.
 *
 * Schedule: Daily at 03:00 UTC (04:00 NL winter / 05:00 NL summer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronMonitoring } from '@/lib/cron-monitor';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';

const DAYS_DELAY = 10; // Remove leads 10 days after campaign_completed

async function cleanupHandler(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log(`🧹 Starting Instantly leads cleanup CRON job at ${new Date().toISOString()}`);
    console.log(`⏰ Delay setting: ${DAYS_DELAY} days`);

    // Call the cleanup method on the sync service
    const result = await instantlyPipedriveSyncService.cleanupCompletedCampaignLeads(DAYS_DELAY);

    const duration = Date.now() - startTime;

    console.log(`✅ Instantly leads cleanup completed in ${duration}ms`);
    console.log(`📊 Results: ${result.processed}/${result.totalEligible} processed, ${result.removed} removed, ${result.skipped} skipped, ${result.errors} errors`);

    if (result.remaining > 0) {
      console.log(`⚠️ ${result.remaining} leads remaining for next run`);
    }

    return NextResponse.json({
      success: true,
      message: 'Instantly leads cleanup completed',
      daysDelay: DAYS_DELAY,
      ...result,
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ Error in Instantly leads cleanup CRON job:', errorMessage);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: errorMessage,
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

// Export secured handlers — GET for Vercel Cron, POST for manual triggers
const monitored = withCronMonitoring('cleanup-instantly-leads', '/api/cron/cleanup-instantly-leads');
export const GET = monitored(cleanupHandler);
export const POST = monitored(cleanupHandler);
