import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient()
    const { sessionId } = params
    
    console.log('Resume API: Fetching session data for sessionId:', sessionId)
    
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
        workflow_state,
        session_name,
        apify_run_id,
        scraping_status,
        scraping_completed_at,
        job_count
      `)
      .eq('session_id', sessionId)
      .single()
    
    if (sessionError) {
      console.error('Session fetch error:', sessionError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch session',
        details: sessionError.message
      }, { status: 404 })
    }
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found',
        details: `No session found with ID: ${sessionId}`
      }, { status: 404 })
    }
    
    // Get associated apify run if it exists
    let apifyRun = null
    if (session.apify_run_id) {
      const { data: run, error: runError } = await supabase
        .from('apify_runs')
        .select('*')
        .eq('id', session.apify_run_id)
        .single()
      
      if (!runError && run) {
        apifyRun = run
      }
    }
    
    // Get workflow data for each stage
    const { data: workflowData, error: workflowError } = await supabase
      .from('otis_workflow_data')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    
    if (workflowError) {
      console.error('Workflow data fetch error:', workflowError)
    }
    
    // Get progress events
    const { data: progressEvents, error: progressError } = await supabase
      .from('otis_progress_events')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    
    if (progressError) {
      console.error('Progress events fetch error:', progressError)
    }
    
    // Reconstruct workflow state
    const workflowState = {
      session: {
        id: session.id,
        sessionId: session.session_id,
        userId: session.user_id,
        status: session.status,
        currentStage: session.current_stage,
        createdAt: session.created_at,
        completedAt: session.completed_at,
        totalJobs: session.total_jobs,
        totalCompanies: session.total_companies,
        totalContacts: session.total_contacts,
        totalCampaigns: session.total_campaigns,
        sessionName: session.session_name,
        apifyRunId: session.apify_run_id,
        scrapingStatus: session.scraping_status,
        scrapingCompletedAt: session.scraping_completed_at,
        jobCount: session.job_count
      },
      apifyRun,
      workflowData: workflowData || [],
      progressEvents: progressEvents || [],
      storedState: session.workflow_state || {}
    }
    
    console.log('Resume API: Successfully reconstructed workflow state for session:', sessionId)
    
    return NextResponse.json({
      success: true,
      session: workflowState
    })
    
  } catch (error) {
    console.error('Resume session error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to resume session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const supabase = createClient()
    const { sessionId } = params
    
    console.log('Resume POST API: Processing resume for sessionId:', sessionId)
    
    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()
    
    if (sessionError || !session) {
      console.error('Resume POST API: Error fetching session:', sessionError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to resume session',
          details: 'Session not found'
        },
        { status: 404 }
      )
    }
    
    // Check if session can be resumed
    if (session.status === 'completed') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to resume session',
          details: 'Cannot resume completed session'
        },
        { status: 400 }
      )
    }
    
    // Update session status to active if it was paused
    if (session.status === 'paused') {
      const { error: updateError } = await supabase
        .from('otis_workflow_sessions')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
      
      if (updateError) {
        console.error('Resume POST API: Error updating session status:', updateError)
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to resume session',
            details: 'Failed to update session status'
          },
          { status: 500 }
        )
      }
    }
    
    console.log('Resume POST API: Session resumed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Session resumed successfully',
      sessionId: sessionId,
      currentStage: session.current_stage
    })
    
  } catch (error) {
    console.error('Resume POST API: Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to resume session',
        details: errorMessage,
        stack: errorStack
      },
      { status: 500 }
    )
  }
} 