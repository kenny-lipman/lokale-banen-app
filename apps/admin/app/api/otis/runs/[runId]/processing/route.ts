import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

type ProcessingStatus = 'not_started' | 'in_progress' | 'completed'

interface UpdateProcessingRequest {
  processing_status?: ProcessingStatus
  processing_notes?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    
    if (!runId) {
      return NextResponse.json(
        { success: false, error: 'Run ID is required' },
        { status: 400 }
      )
    }

    const body: UpdateProcessingRequest = await req.json()
    
    // Validate processing_status if provided
    if (body.processing_status) {
      const validStatuses: ProcessingStatus[] = ['not_started', 'in_progress', 'completed']
      if (!validStatuses.includes(body.processing_status)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid processing status. Must be one of: ${validStatuses.join(', ')}` 
          },
          { status: 400 }
        )
      }
    }

    // Validate processing_notes length if provided
    if (body.processing_notes !== undefined && body.processing_notes.length > 500) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Processing notes must be 500 characters or less' 
        },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()
    
    // Build update object
    const updateData: any = {
      processed_at: new Date().toISOString()
    }
    
    if (body.processing_status !== undefined) {
      updateData.processing_status = body.processing_status
    }
    
    if (body.processing_notes !== undefined) {
      updateData.processing_notes = body.processing_notes
    }

    // Update the run
    const { data, error } = await supabase
      .from('apify_runs')
      .update(updateData)
      .eq('id', runId)
      .select(`
        id,
        title,
        processing_status,
        processing_notes,
        processed_at,
        processed_by
      `)
      .single()

    if (error) {
      console.error('Error updating run processing status:', error)
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Run not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to update processing status',
          details: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      run: data
    })

  } catch (error) {
    console.error('Error in processing update endpoint:', error)
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

// Get processing status for a specific run
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    
    if (!runId) {
      return NextResponse.json(
        { success: false, error: 'Run ID is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceRoleClient()
    
    const { data, error } = await supabase
      .from('apify_runs')
      .select(`
        id,
        title,
        processing_status,
        processing_notes,
        processed_at,
        processed_by
      `)
      .eq('id', runId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Run not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch processing status',
          details: error.message 
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      run: data
    })

  } catch (error) {
    console.error('Error fetching processing status:', error)
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