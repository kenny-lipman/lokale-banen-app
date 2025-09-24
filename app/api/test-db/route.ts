import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { withAuth } from '@/lib/auth-middleware'

async function testDbHandler(req: NextRequest) {
  try {
    const supabase = createClient()
    
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('otis_workflow_sessions')
      .select('count', { count: 'exact', head: true })
    
    if (testError) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        details: testError.message
      })
    }
    
    // Get all sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (sessionsError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch sessions',
        details: sessionsError.message
      })
    }
    
    // Get workflow data
    const { data: workflowData, error: workflowError } = await supabase
      .from('otis_workflow_data')
      .select('*')
      .limit(5)
    
    return NextResponse.json({
      success: true,
      totalSessions: testData,
      sessions: sessions || [],
      workflowData: workflowData || [],
      workflowError: workflowError?.message
    })
    
  } catch (error) {
    console.error('Test DB API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Export the wrapped handler
export const GET = withAuth(testDbHandler) 