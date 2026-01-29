/**
 * Instantly Backfill Endpoint
 *
 * Backfills leads from Instantly campaigns to Pipedrive.
 * Use this for initial setup or to sync historical data.
 *
 * Supports chunked processing: when processing large batches,
 * the endpoint stops after ~240s and returns done: false.
 * The frontend can send subsequent requests to continue —
 * skipExisting ensures already-synced leads are quickly skipped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';
import { instantlyClient } from '@/lib/instantly-client';

// Allow up to 300s on Vercel Pro
export const maxDuration = 300;

// Secret for protecting the backfill endpoint
const BACKFILL_SECRET = process.env.INSTANTLY_BACKFILL_SECRET || process.env.CRON_SECRET_KEY;

// Stop processing after this many ms to leave room for response
const PROCESSING_TIME_LIMIT_MS = 240_000;

/**
 * Validate the request has proper authorization.
 * Accepts: secret key (cron/external) OR browser session cookie (dashboard).
 */
function validateRequest(req: NextRequest): boolean {
  // Allow browser/dashboard requests (have Supabase session cookie)
  const cookies = req.headers.get('cookie') || '';
  if (cookies.includes('sb-') && cookies.includes('auth-token')) {
    return true;
  }

  if (!BACKFILL_SECRET) {
    console.warn('⚠️ No INSTANTLY_BACKFILL_SECRET configured');
    return true;
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
  max_leads?: number;
  status_filter?: string;
  time_limit_ms?: number;
}

/**
 * POST /api/instantly/backfill
 *
 * Runs a backfill operation for specified campaigns or all campaigns.
 * Supports chunked processing for large batches (500+ leads).
 *
 * Request body:
 * - campaign_ids: Array of campaign IDs to backfill (optional, defaults to all)
 * - dry_run: If true, just report what would be synced without actually syncing
 * - batch_size: Number of leads to process in each batch (default: 50)
 * - max_leads: Maximum leads per campaign to fetch from Instantly
 * - status_filter: Only process campaigns with this status (e.g., 'completed')
 *
 * Response includes `done: boolean` — if false, send another request to continue processing.
 * skipExisting (default: true) ensures already-synced leads are quickly skipped (~1ms each).
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
      max_leads,
      status_filter,
      time_limit_ms
    } = options;

    // Use custom time limit if provided, otherwise use default
    const effectiveTimeLimit = time_limit_ms && time_limit_ms > 0
      ? Math.min(time_limit_ms, PROCESSING_TIME_LIMIT_MS)
      : PROCESSING_TIME_LIMIT_MS;

    console.log(`🔄 Starting backfill operation...`, {
      campaignIds: campaign_ids?.length || 'all',
      dryRun: dry_run,
      batchSize: batch_size,
      maxLeads: max_leads || 'all',
      statusFilter: status_filter,
      timeLimitMs: effectiveTimeLimit,
    });

    // 3. Run the backfill
    let result;

    if (campaign_ids && campaign_ids.length === 1) {
      // Single campaign backfill
      result = await instantlyPipedriveSyncService.backfillCampaign(campaign_ids[0], {
        dryRun: dry_run,
        batchSize: batch_size,
        maxLeads: max_leads,
        timeLimitMs: effectiveTimeLimit,
        timeLimitStartedAt: startTime,
      });

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        done: !result.stoppedEarly,
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
        statusFilter: status_filter,
        maxLeadsPerCampaign: max_leads,
        timeLimitMs: effectiveTimeLimit,
        timeLimitStartedAt: startTime,
      });

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        done: !result.stoppedEarly,
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
