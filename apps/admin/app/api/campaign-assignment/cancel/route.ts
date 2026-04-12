import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

/**
 * POST /api/campaign-assignment/cancel
 * Cancel active campaign assignment batch(es)
 * Supports: { batchId } for single batch, { orchestrationId } for all batches in orchestration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { batchId, orchestrationId } = body

    const supabase = createServiceRoleClient()

    // Cancel by orchestration ID — cancels all batches in the orchestration
    if (orchestrationId) {
      const { data: batches, error: fetchError } = await (supabase as any)
        .from('campaign_assignment_batches')
        .select('batch_id, status')
        .eq('orchestration_id', orchestrationId)
        .in('status', ['processing', 'pending'])

      if (fetchError) {
        console.error('Error fetching orchestration batches:', fetchError)
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch orchestration batches'
        }, { status: 500 })
      }

      if (!batches || batches.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active batches found for this orchestration'
        }, { status: 404 })
      }

      const batchIds = batches.map((b: { batch_id: string }) => b.batch_id)
      const { error } = await (supabase as any)
        .from('campaign_assignment_batches')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .in('batch_id', batchIds)

      if (error) {
        console.error('Error cancelling orchestration batches:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to cancel batches'
        }, { status: 500 })
      }

      console.log(`⏹️ Cancelled ${batchIds.length} batches for orchestration ${orchestrationId}`)

      return NextResponse.json({
        success: true,
        orchestrationId,
        cancelledCount: batchIds.length,
        message: `${batchIds.length} batches cancelled`
      })
    }

    // Cancel by batch ID or find most recent active batch
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
