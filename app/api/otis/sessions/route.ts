import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    
    // Calculate offset
    const offset = (page - 1) * limit
    
    // Build query
    let query = supabase
      .from('otis_workflow_sessions')
      .select(`
        id,
        session_id,
        status,
        current_stage,
        created_at,
        completed_at,
        total_jobs,
        total_companies,
        total_contacts,
        total_campaigns,
        workflow_state
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }
    
    // Execute query
    const { data: sessions, error, count } = await query
    
    if (error) {
      console.error('Error fetching sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }
    
    // Calculate duration and extract session metadata for each session
    const sessionsWithDuration = sessions?.map(session => {
      const workflowState = session.workflow_state || {}
      const scrapingData = workflowState.scraping || {}
      
      return {
        ...session,
        session_name: scrapingData.sessionName || `Session ${session.session_id}`,
        session_type: scrapingData.type || 'multi-job',
        duration_minutes: session.completed_at 
          ? Math.round((new Date(session.completed_at).getTime() - new Date(session.created_at!).getTime()) / (1000 * 60))
          : Math.round((Date.now() - new Date(session.created_at!).getTime()) / (1000 * 60))
      }
    }) || []
    
    return NextResponse.json({
      sessions: sessionsWithDuration,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
    
  } catch (error) {
    console.error('Unexpected error in sessions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 