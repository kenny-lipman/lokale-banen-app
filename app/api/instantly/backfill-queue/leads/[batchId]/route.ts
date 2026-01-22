import { NextRequest, NextResponse } from 'next/server';
import { instantlyBackfillService, BackfillLeadStatus } from '@/lib/services/instantly-backfill.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as BackfillLeadStatus | null;
    const hasError = searchParams.get('hasError') === 'true';
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await instantlyBackfillService.getLeadStatuses(batchId, {
      status: status || undefined,
      hasError: hasError || undefined,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to get leads:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get leads',
      },
      { status: 500 }
    );
  }
}
