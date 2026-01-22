import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

/**
 * POST /api/campaign-assignment/cancel
 * Cancel an active campaign assignment batch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { batchId } = body

    const supabase = createServiceRoleClient()

    // If no batchId provided, cancel the most recent active batch
    let targetBatchId = batchId

    if (!targetBatchId) {
      const { data: activeBatch } = await (supabase as any)
        .from('campaign_assignment_batches')
        .select('batch_id')
        .in('status', ['processing', 'pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!activeBatch) {
        return NextResponse.json({
          success: false,
          error: 'No active batch found to cancel'
        }, { status: 404 })
      }

      targetBatchId = activeBatch.batch_id
    }

    // Update batch status to cancelled
    const { error } = await (supabase as any)
      .from('campaign_assignment_batches')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('batch_id', targetBatchId)

    if (error) {
      console.error('Error cancelling batch:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to cancel batch'
      }, { status: 500 })
    }

    console.log(`⏹️ Campaign assignment batch ${targetBatchId} cancelled`)

    return NextResponse.json({
      success: true,
      batchId: targetBatchId,
      message: 'Batch cancelled successfully'
    })
  } catch (error) {
    console.error('Error in cancel endpoint:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
