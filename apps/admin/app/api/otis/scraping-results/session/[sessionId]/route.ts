import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    console.log('Fetching detailed results for session:', sessionId)

    // Get detailed scraping results
    const results = await supabaseService.getScrapingResultsBySessionId(sessionId)
    
    return NextResponse.json(results)

  } catch (error) {
    console.error('Error fetching scraping results:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 