/**
 * Retry Failed Syncs Endpoint
 *
 * Retries all failed sync operations.
 */

// @auth ADMIN

import { NextRequest, NextResponse } from 'next/server';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware';

/**
 * POST /api/instantly/retry-failed
 *
 * Retries all failed sync operations
 */
async function postHandler(req: NextRequest, _auth: AuthResult) {
  const startTime = Date.now();

  try {
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
async function getHandler(req: NextRequest, _auth: AuthResult) {
  try {
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

export const POST = withAdminAuth(postHandler);
export const GET = withAdminAuth(getHandler);
