import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService } from '@/lib/services/instantly-backfill.service';
import { withAuth, AuthResult } from '@/lib/auth-middleware';

// @auth SESSION
type Ctx = { params: Promise<{ batchId: string }> }

async function getHandler(
  request: NextRequest,
  _auth: AuthResult,
  { params }: Ctx
) {
  try {
    const { batchId } = await params;
    const { searchParams } = new URL(request.url);
    const lightweight = searchParams.get('lightweight') === 'true';

    const status = await instantlyBackfillService.getBatchStatus(batchId, lightweight);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Failed to get batch status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);
