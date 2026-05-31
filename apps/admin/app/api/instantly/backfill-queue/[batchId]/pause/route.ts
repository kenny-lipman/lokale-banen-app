import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService } from '@/lib/services/instantly-backfill.service';
import { withAuth, AuthResult } from '@/lib/auth-middleware';

// @auth SESSION

type Ctx = { params: Promise<{ batchId: string }> }

async function postHandler(
  request: NextRequest,
  _auth: AuthResult,
  { params }: Ctx
) {
  try {
    const { batchId } = await params;

    await instantlyBackfillService.pauseBatch(batchId);

    return NextResponse.json({
      success: true,
      message: 'Batch paused successfully',
    });
  } catch (error) {
    console.error('Failed to pause batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause batch',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
