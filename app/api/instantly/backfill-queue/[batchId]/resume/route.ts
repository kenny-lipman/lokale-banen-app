import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService } from '@/lib/services/instantly-backfill.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;

    await instantlyBackfillService.resumeBatch(batchId);

    return NextResponse.json({
      success: true,
      message: 'Batch resumed successfully',
    });
  } catch (error) {
    console.error('Failed to resume batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume batch',
      },
      { status: 500 }
    );
  }
}
