/**
 * Retry Failed Syncs Endpoint
 *
 * Retries all failed sync operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';

// Secret for protecting the retry endpoint
const RETRY_SECRET = process.env.INSTANTLY_BACKFILL_SECRET || process.env.CRON_SECRET_KEY;

/**
 * Validate the request has proper authorization
 */
function validateRequest(req: NextRequest): boolean {
  if (!RETRY_SECRET) {
    return true; // Allow if no secret is configured
  }

  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');
  const secretHeader = req.headers.get('x-retry-secret');
  const authHeader = req.headers.get('authorization');

  return (
    secretParam === RETRY_SECRET ||
    secretHeader === RETRY_SECRET ||
    authHeader === `Bearer ${RETRY_SECRET}`
  );
}

/**
 * POST /api/instantly/retry-failed
 *
 * Retries all failed sync operations
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Validate authorization
    if (!validateRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing secret' },
        { status: 401 }
      );
    }

    console.log('🔄 Starting retry of failed syncs...');

    const result = await instantlyPipedriveSyncService.retryFailedSyncs();

    const duration = Date.now() - startTime;

    console.log(`✅ Retry complete: ${result.succeeded}/${result.retried} succeeded`);

    return NextResponse.json({
      success: true,
      retried: result.retried,
      succeeded: result.succeeded,
      failed: result.failed,
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Retry error:', error);

    return NextResponse.json(
      {
        error: 'Retry failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instantly/retry-failed
 *
 * Gets a list of failed syncs that can be retried
 */
export async function GET(req: NextRequest) {
  try {
    // Validate authorization
    if (!validateRequest(req)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing secret' },
        { status: 401 }
      );
    }

    const failedSyncs = await instantlyPipedriveSyncService.getFailedSyncs();

    return NextResponse.json({
      count: failedSyncs.length,
      syncs: failedSyncs.map(sync => ({
        id: sync.id,
        email: sync.instantly_lead_email,
        campaign: sync.instantly_campaign_name,
        eventType: sync.event_type,
        error: sync.sync_error,
        attempts: sync.sync_attempts,
        createdAt: sync.created_at
      }))
    });
  } catch (error) {
    console.error('❌ Error getting failed syncs:', error);
    return NextResponse.json(
      {
        error: 'Failed to get failed syncs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
