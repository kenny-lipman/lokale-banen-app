import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService } from '@/lib/services/instantly-backfill.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const body = await request.json().catch(() => ({}));

    const { leadIds } = body; // Optional: specific lead IDs to retry

    const result = await instantlyBackfillService.retryFailedLeads(batchId, leadIds);

    return NextResponse.json({
      success: true,
      message: `Retrying ${result.retried} failed leads`,
      retried: result.retried,
    });
  } catch (error) {
    console.error('Failed to retry leads:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry leads',
      },
      { status: 500 }
    );
  }
}
