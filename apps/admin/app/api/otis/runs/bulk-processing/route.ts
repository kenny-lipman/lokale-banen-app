import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

type ProcessingStatus = 'not_started' | 'in_progress' | 'completed'

interface BulkUpdateRequest {
  runIds: string[]
  processing_status: ProcessingStatus
}

export async function PATCH(req: NextRequest) {
  try {
    const body: BulkUpdateRequest = await req.json()
    
    // Validate request body
    if (!body.runIds || !Array.isArray(body.runIds) || body.runIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'runIds must be a non-empty array' 
        },
        { status: 400 }
      )
    }

    // Limit bulk operations to 100 runs
    if (body.runIds.length > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum 100 runs can be updated at once' 
        },
        { status: 400 }
      )
    }

    // Validate processing_status
    const validStatuses: ProcessingStatus[] = ['not_started', 'in_progress', 'completed']
    if (!body.processing_status || !validStatuses.includes(body.processing_status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid processing status. Must be one of: ${validStatuses.join(', ')}` 
        },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()
    
    // Update all runs with the new status
    const { data, error } = await supabase
      .from('apify_runs')
      .update({
        processing_status: body.processing_status,
        processed_at: new Date().toISOString()
      })
      .in('id', body.runIds)
      .select('id')

    if (error) {
      console.error('Error bulk updating processing status:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update processing status',
          details: error.message 
        },
        { status: 500 }
      )
    }

    const updatedCount = data?.length || 0

    // Log if not all runs were updated (some IDs might not exist)
    if (updatedCount < body.runIds.length) {
      console.warn(
        `Bulk update: Only ${updatedCount} of ${body.runIds.length} runs were updated. ` +
        `Some run IDs may not exist.`
      )
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      requested: body.runIds.length
    })

  } catch (error) {
    console.error('Error in bulk processing update endpoint:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get processing stats for multiple runs
export async function POST(req: NextRequest) {
  try {
    const { runIds } = await req.json()
    
    if (!runIds || !Array.isArray(runIds) || runIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'runIds must be a non-empty array' 
        },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()
    
    const { data, error } = await supabase
      .from('apify_runs')
      .select(`
        id,
        processing_status,
        processing_notes,
        processed_at
      `)
      .in('id', runIds)

    if (error) {
      console.error('Error fetching bulk processing status:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch processing status',
          details: error.message 
        },
        { status: 500 }
      )
    }

    // Calculate stats
    const stats = {
      total: runIds.length,
      not_started: 0,
      in_progress: 0,
      completed: 0,
      runs: data || []
    }

    data?.forEach(run => {
      const status = run.processing_status || 'not_started'
      if (status === 'not_started') stats.not_started++
      else if (status === 'in_progress') stats.in_progress++
      else if (status === 'completed') stats.completed++
    })

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error fetching bulk processing stats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}