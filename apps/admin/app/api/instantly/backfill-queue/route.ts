import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService, BackfillBatchStatus } from '@/lib/services/instantly-backfill.service';
import { withAuth, AuthResult } from '@/lib/auth-middleware';

// @auth SESSION

/**
 * List all backfill batches
 */
async function getHandler(request: NextRequest, _auth: AuthResult) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as BackfillBatchStatus | null;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const batches = await instantlyBackfillService.listBatches({
      status: status || undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error('Failed to list batches:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list batches',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
