/**
 * Bulk Cleanup: Remove completed/bounced leads directly from Instantly API
 *
 * Unlike the regular cleanup (which works from our contacts DB), this endpoint
 * iterates through Instantly campaigns via the API to find and remove leads
 * that may not even exist in our contacts table.
 *
 * Supports dry-run mode to preview what would be removed.
 *
 * POST /api/cron/bulk-cleanup-instantly
 * Body: {
 *   dryRun?: boolean (default: true for safety)
 *   maxLeadsPerCampaign?: number (default: 500, max: 2000)
 *   campaignIds?: string[] (default: all Algemene campaigns)
 *   includeCompleted?: boolean (default: true)
 *   includeBounced?: boolean (default: true)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronMonitoring } from '@/lib/cron-monitor';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';

async function bulkCleanupHandler(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse options from request body
    let dryRun = true; // Default to dry-run for safety
    let maxLeadsPerCampaign = 500;
    let campaignIds: string[] | undefined;
    let includeCompleted = true;
    let includeBounced = true;

    try {
      const body = await request.json();
      if (typeof body.dryRun === 'boolean') dryRun = body.dryRun;
      if (typeof body.maxLeadsPerCampaign === 'number' && body.maxLeadsPerCampaign >= 1 && body.maxLeadsPerCampaign <= 2000) {
        maxLeadsPerCampaign = body.maxLeadsPerCampaign;
      }
      if (Array.isArray(body.campaignIds) && body.campaignIds.length > 0) {
        campaignIds = body.campaignIds;
      }
      if (typeof body.includeCompleted === 'boolean') includeCompleted = body.includeCompleted;
      if (typeof body.includeBounced === 'boolean') includeBounced = body.includeBounced;
    } catch {
      // No body provided, use defaults (dry-run)
    }

    console.log(`🧹 Bulk Instantly cleanup starting (dryRun: ${dryRun})`);

    const result = await instantlyPipedriveSyncService.bulkCleanupFromInstantly({
      campaignIds,
      maxLeadsPerCampaign,
      dryRun,
      includeCompleted,
      includeBounced,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: dryRun ? 'Dry run complete — no leads were deleted' : 'Bulk cleanup complete',
      ...result,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('❌ Bulk cleanup error:', errorMessage);

    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage, duration: `${duration}ms` },
      { status: 500 }
    );
  }
}

const monitored = withCronMonitoring('bulk-cleanup-instantly', '/api/cron/bulk-cleanup-instantly');
export const POST = monitored(bulkCleanupHandler);
