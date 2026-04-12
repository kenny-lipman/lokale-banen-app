import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient()
    const { sessionId } = params
    
    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('otis_workflow_sessions')
      .select(`
        id,
        session_id,
        user_id,
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
      .eq('session_id', sessionId)
      .single()
    
    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }
    
    // Get workflow data for all stages
    const { data: workflowData, error: dataError } = await supabase
      .from('otis_workflow_data')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    
    if (dataError) {
      console.error('Error fetching workflow data:', dataError)
      return NextResponse.json(
        { error: 'Failed to fetch workflow data' },
        { status: 500 }
      )
    }
    
    // Get progress events
    const { data: progressEvents, error: eventsError } = await supabase
      .from('otis_progress_events')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    
    if (eventsError) {
      console.error('Error fetching progress events:', eventsError)
      return NextResponse.json(
        { error: 'Failed to fetch progress events' },
        { status: 500 }
      )
    }
    
    // Calculate duration
    const duration_minutes = session.completed_at 
      ? Math.round((new Date(session.completed_at).getTime() - new Date(session.created_at!).getTime()) / (1000 * 60))
      : Math.round((Date.now() - new Date(session.created_at!).getTime()) / (1000 * 60))
    
    // Build timeline
    const timeline = []
    
    // Add session creation
    timeline.push({
      timestamp: session.created_at,
      event: 'Session Created',
      stage: 'init',
      details: 'Workflow session started'
    })
    
    // Add stage completions from workflow data
    workflowData?.forEach(stageData => {
      timeline.push({
        timestamp: stageData.created_at,
        event: `${stageData.stage_name.charAt(0).toUpperCase() + stageData.stage_name.slice(1)} Completed`,
        stage: stageData.stage_name,
        details: `Stage data saved with ${Object.keys(stageData.data || {}).length} items`
      })
    })
    
    // Add progress events
    progressEvents?.forEach(event => {
      timeline.push({
        timestamp: event.created_at,
        event: event.event_type,
        stage: 'progress',
        details: event.event_data
      })
    })
    
    // Add session completion
    if (session.completed_at) {
      timeline.push({
        timestamp: session.completed_at,
        event: 'Session Completed',
        stage: 'complete',
        details: 'All stages completed successfully'
      })
    }
    
    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())
    
    return NextResponse.json({
      session: {
        ...session,
        duration_minutes
      },
      workflowData: workflowData || [],
      progressEvents: progressEvents || [],
      timeline
    })
    
  } catch (error) {
    console.error('Unexpected error in session details API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 