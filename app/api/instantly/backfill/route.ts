/**
 * Instantly Backfill Endpoint
 *
 * Backfills leads from Instantly campaigns to Pipedrive.
 * Use this for initial setup or to sync historical data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';
import { instantlyClient } from '@/lib/instantly-client';

// Secret for protecting the backfill endpoint
const BACKFILL_SECRET = process.env.INSTANTLY_BACKFILL_SECRET || process.env.CRON_SECRET_KEY;

/**
 * Validate the request has proper authorization
 */
function validateRequest(req: NextRequest): boolean {
  if (!BACKFILL_SECRET) {
    console.warn('⚠️ No INSTANTLY_BACKFILL_SECRET configured');
    return true; // Allow if no secret is configured (not recommended for production)
  }

  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');
  const secretHeader = req.headers.get('x-backfill-secret');
  const authHeader = req.headers.get('authorization');

  return (
    secretParam === BACKFILL_SECRET ||
    secretHeader === BACKFILL_SECRET ||
    authHeader === `Bearer ${BACKFILL_SECRET}`
  );
}

interface BackfillRequestBody {
  campaign_ids?: string[];
  dry_run?: boolean;
  batch_size?: number;
  status_filter?: string;
}

/**
 * POST /api/instantly/backfill
 *
 * Runs a backfill operation for specified campaigns or all campaigns
 *
 * Request body:
 * - campaign_ids: Array of campaign IDs to backfill (optional, defaults to all)
 * - dry_run: If true, just report what would be synced without actually syncing
 * - batch_size: Number of leads to process in each batch (default: 50)
 * - status_filter: Only process campaigns with this status (e.g., 'completed')
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate authorization
    if (!validateRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing secret' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let options: BackfillRequestBody = {};
    try {
      options = await req.json();
    } catch {
      // No body provided, use defaults
    }

    const {
      campaign_ids,
      dry_run = false,
      batch_size = 50,
      status_filter
    } = options;

    console.log(`🔄 Starting backfill operation...`, {
      campaignIds: campaign_ids?.length || 'all',
      dryRun: dry_run,
      batchSize: batch_size,
      statusFilter: status_filter
    });

    // 3. Run the backfill
    let result;

    if (campaign_ids && campaign_ids.length === 1) {
      // Single campaign backfill
      result = await instantlyPipedriveSyncService.backfillCampaign(campaign_ids[0], {
        dryRun: dry_run,
        batchSize: batch_size
      });

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        dryRun: dry_run,
        campaignId: campaign_ids[0],
        total: result.total,
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors,
        duration: `${duration}ms`,
        details: result.results.slice(0, 100) // Limit details to first 100
      });
    } else {
      // Multiple or all campaigns
      result = await instantlyPipedriveSyncService.backfillAllCampaigns({
        dryRun: dry_run,
        campaignIds: campaign_ids,
        statusFilter: status_filter
      });

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        dryRun: dry_run,
        campaigns: result.campaigns,
        totalLeads: result.totalLeads,
        synced: result.synced,
        skipped: result.skipped,
        errors: result.errors,
        duration: `${duration}ms`
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Backfill error:', error);

    return NextResponse.json(
      {
        error: 'Backfill failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instantly/backfill
 *
 * Gets information about available campaigns for backfill
 */
export async function GET(req: NextRequest) {
  try {
    // Validate authorization for listing
    if (!validateRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing secret' },
        { status: 401 }
      );
    }

    // Get all campaigns
    const campaigns = await instantlyClient.listCampaigns();

    // Get stats for each campaign
    const campaignsWithStats = await Promise.all(
      campaigns.slice(0, 50).map(async (campaign) => { // Limit to 50 to avoid rate limits
        try {
          const analytics = await instantlyClient.getCampaignAnalytics(campaign.id);
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            leadsCount: analytics?.leads_count || 0,
            completedCount: analytics?.completed_count || 0,
            replyCount: analytics?.reply_count || 0
          };
        } catch {
          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            leadsCount: null,
            completedCount: null,
            replyCount: null
          };
        }
      })
    );

    return NextResponse.json({
      totalCampaigns: campaigns.length,
      campaigns: campaignsWithStats,
      note: campaigns.length > 50 ? 'Only showing first 50 campaigns with stats' : undefined
    });
  } catch (error) {
    console.error('❌ Error getting backfill info:', error);
    return NextResponse.json(
      {
        error: 'Failed to get backfill info',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
