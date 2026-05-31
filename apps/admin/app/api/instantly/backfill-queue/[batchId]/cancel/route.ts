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

    await instantlyBackfillService.cancelBatch(batchId);

    return NextResponse.json({
      success: true,
      message: 'Batch cancelled successfully',
    });
  } catch (error) {
    console.error('Failed to cancel batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel batch',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
