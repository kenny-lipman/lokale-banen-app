import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get session status from otis_workflow_sessions table
    const { data: session, error: sessionError } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get progress data for current stage
    const { data: progressData, error: progressError } = await supabase
      .from('session_progress')
      .select('*')
      .eq('session_id', sessionId)
      .eq('stage', session.current_stage)
      .single()

    // Default progress structure
    const defaultProgress = {
      total: 0,
      completed: 0,
      failed: 0,
      status: 'pending'
    }

    // Get stage-specific progress
    let stageProgress = defaultProgress
    
    if (progressData && !progressError) {
      stageProgress = {
        total: progressData.total || 0,
        completed: progressData.completed || 0,
        failed: progressData.failed || 0,
        status: progressData.status || 'pending'
      }
    } else {
      // If no progress data exists, create default based on stage
      switch (session.current_stage) {
        case 'scraping':
          stageProgress = { ...defaultProgress, total: 100 }
          break
        case 'enrichment':
          stageProgress = { ...defaultProgress, total: 50 }
          break
        case 'campaigns':
          stageProgress = { ...defaultProgress, total: 25 }
          break
        case 'results':
          stageProgress = { ...defaultProgress, total: 10, completed: 10 }
          break
      }
    }

    // Mock progress for demonstration (remove in production)
    if (session.status === 'active') {
      const mockProgress = Math.min(
        stageProgress.completed + Math.floor(Math.random() * 5) + 1,
        stageProgress.total
      )
      stageProgress.completed = mockProgress
    }

    const response = {
      sessionId,
      currentStage: session.current_stage,
      isProcessing: session.status === 'active',
      progress: stageProgress,
      completedStages: [], // TODO: Implement completed stages tracking
      lastUpdate: new Date().toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const { stage, total, completed, failed, status } = body

    if (!stage) {
      return NextResponse.json(
        { error: 'Stage is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Upsert progress data
    const { data, error } = await supabase
      .from('session_progress')
      .upsert({
        session_id: sessionId,
        stage,
        total: total || 0,
        completed: completed || 0,
        failed: failed || 0,
        status: status || 'pending',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,stage'
      })

    if (error) {
      console.error('Error updating progress:', error)
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error updating progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 