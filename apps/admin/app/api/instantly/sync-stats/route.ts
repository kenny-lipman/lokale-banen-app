/**
 * Instantly Sync Stats Endpoint
 *
 * Provides statistics and monitoring data for the Instantly → Pipedrive sync.
 */

import { NextRequest, NextResponse } from 'next/server';
import { instantlyPipedriveSyncService } from '@/lib/services/instantly-pipedrive-sync.service';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware';

// @auth ADMIN

/**
 * GET /api/instantly/sync-stats
 *
 * Returns sync statistics
 */
async function getHandler(req: NextRequest, _auth: AuthResult) {
  try {
    const stats = await instantlyPipedriveSyncService.getStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error getting sync stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const GET = withAdminAuth(getHandler);
