import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    // Use type assertion since these tables aren't in generated types yet
    const supabase = createServiceRoleClient() as any;

    // First get the batch UUID from batch_id
    const { data: batch, error: batchError } = await supabase
      .from('instantly_backfill_batches')
      .select('id')
      .eq('batch_id', batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    // Get activity logs
    const { data: logs, error: logsError } = await supabase
      .from('instantly_backfill_activity_logs')
      .select('*')
      .eq('batch_id', batch.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (logsError) {
      console.error('Error fetching activity logs:', logsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: logs || [],
    });
  } catch (error) {
    console.error('Error in activity logs endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
