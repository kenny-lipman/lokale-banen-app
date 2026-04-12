import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase'

// Enhanced WebSocket message types
interface EnrichmentWebSocketMessage {
  type: 'enrichment_progress_update' | 'new_companies_found' | 'enrichment_complete' | 'scraping_update' | 'status_change' | 'connected' | 'heartbeat' | 'error'
  sessionId: string
  data?: {
    newCompanies?: number
    newJobs?: number
    enrichmentProgress?: {
      total: number
      completed: number
      failed: number
    }
    scrapingProgress?: {
      total: number
      completed: number
      failed: number
    }
    timestamp: string
    error?: string
  }
  timestamp: string
}

// Connection management
const activeConnections = new Map<string, ReadableStreamDefaultController>()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session')
  
  if (!sessionId) {
    console.error('No session ID provided in WebSocket request')
    return new Response('Session ID required', { status: 400 })
  }

  console.log('WebSocket connection request for session:', sessionId)
  
  // Verify session exists
  const supabase = createClient()
  console.log('Supabase client created')
  
  const { data: session, error } = await supabase
    .from('otis_workflow_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  console.log('Database query result:', { session, error })

  // Handle missing session gracefully instead of returning 401
  if (error || !session) {
    console.log('Session not found for:', sessionId, 'Error:', error)
    
    // Send error message to client and close connection gracefully
    const errorMessage: EnrichmentWebSocketMessage = {
      type: 'error',
      sessionId,
      data: {
        error: 'Session not found',
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    }
    
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(`data: ${JSON.stringify(errorMessage)}\n\n`)
        // Close connection after sending error
        setTimeout(() => {
          controller.close()
        }, 1000)
      }
    })

    return new Response(errorStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })
  }

  console.log('Session verified for:', sessionId)

  // Set up Server-Sent Events with enhanced real-time capabilities
  const stream = new ReadableStream({
    start(controller) {
      // Store connection for real-time updates
      activeConnections.set(sessionId, controller)
      
      // Send initial connection confirmation
      const initialMessage: EnrichmentWebSocketMessage = {
        type: 'connected',
        sessionId,
        timestamp: new Date().toISOString()
      }
      
      controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`)
      
      // Send current session status
      sendSessionStatus(sessionId, controller)
      
      // Set up interval to send periodic updates and check for changes
      const interval = setInterval(async () => {
        try {
          // Send heartbeat to keep connection alive
          const heartbeat: EnrichmentWebSocketMessage = {
            type: 'heartbeat',
            sessionId,
            timestamp: new Date().toISOString()
          }
          
          controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`)
          
          // Check for session updates
          await checkForSessionUpdates(sessionId, controller)
        } catch (error) {
          console.error('Error in WebSocket interval:', error)
          clearInterval(interval)
          activeConnections.delete(sessionId)
          controller.close()
        }
      }, 15000) // Check every 15 seconds
      
      // Clean up on close
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        activeConnections.delete(sessionId)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

// Function to send session status
async function sendSessionStatus(sessionId: string, controller: ReadableStreamDefaultController) {
  try {
    const supabase = createClient()
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .select(`
        session_id,
        current_stage,
        status,
        total_jobs,
        total_companies,
        total_contacts,
        scraping_status,
        scraping_completed_at,
        job_count,
        workflow_state
      `)
      .eq('session_id', sessionId)
      .single()

    if (error || !session) {
      console.error('Error fetching session status:', error)
      return
    }

    const statusMessage: EnrichmentWebSocketMessage = {
      type: 'status_change',
      sessionId,
      data: {
        currentStage: session.current_stage,
        status: session.status,
        totalJobs: session.total_jobs || 0,
        totalCompanies: session.total_companies || 0,
        totalContacts: session.total_contacts || 0,
        scrapingStatus: session.scraping_status,
        jobCount: session.job_count || 0,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    }

    controller.enqueue(`data: ${JSON.stringify(statusMessage)}\n\n`)
  } catch (error) {
    console.error('Error sending session status:', error)
  }
}

// Function to check for session updates
async function checkForSessionUpdates(sessionId: string, controller: ReadableStreamDefaultController) {
  try {
    const supabase = createClient()
    
    // Check for new companies or jobs
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .select('total_companies, total_jobs, job_count, updated_at')
      .eq('session_id', sessionId)
      .single()

    if (error || !session) return

    // Get the last known state (you might want to store this in memory or cache)
    // For now, we'll send updates based on current data
    const updateMessage: EnrichmentWebSocketMessage = {
      type: 'enrichment_progress_update',
      sessionId,
      data: {
        newCompanies: session.total_companies || 0,
        newJobs: session.total_jobs || 0,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    }

    controller.enqueue(`data: ${JSON.stringify(updateMessage)}\n\n`)
  } catch (error) {
    console.error('Error checking for session updates:', error)
  }
}

// Function to broadcast updates to all connections for a session
export async function broadcastToSession(sessionId: string, message: EnrichmentWebSocketMessage) {
  const controller = activeConnections.get(sessionId)
  if (controller) {
    try {
      controller.enqueue(`data: ${JSON.stringify(message)}\n\n`)
    } catch (error) {
      console.error('Error broadcasting to session:', error)
      activeConnections.delete(sessionId)
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, type, data } = await req.json()
    
    if (!sessionId || !type) {
      return new Response('Session ID and type required', { status: 400 })
    }

    // Verify session exists
    const supabase = createClient()
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error || !session) {
      console.log('Session verification failed for POST:', sessionId, 'Error:', error)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Session not found',
        details: 'The requested session does not exist in the database'
      }), { status: 404 })
    }

    console.log('POST request for verified session:', sessionId, 'type:', type)

    // Handle different message types
    switch (type) {
      case 'subscribe_progress':
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Subscribed to progress updates',
          sessionId 
        }))
        
      case 'get_status':
        const status = await getCurrentStatus(sessionId)
        return new Response(JSON.stringify({
          success: true,
          data: status
        }))
        
      case 'progress_update':
        // Broadcast the update to all connections for this session
        const broadcastMessage: EnrichmentWebSocketMessage = {
          type: 'enrichment_progress_update',
          sessionId,
          data,
          timestamp: new Date().toISOString()
        }
        await broadcastToSession(sessionId, broadcastMessage)
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Progress update broadcasted',
          data
        }))
        
      case 'user_action':
        // Log user actions for debugging
        console.log('User action received:', { sessionId, action: data?.action, fromStage: data?.fromStage, toStage: data?.toStage })
        return new Response(JSON.stringify({
          success: true,
          message: 'User action logged',
          action: data?.action
        }))
        
      default:
        console.log('Unknown message type received:', type, 'data:', data)
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Unknown message type',
          receivedType: type
        }), { status: 400 })
    }
  } catch (error) {
    console.error('Error handling POST request:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 })
  }
}

async function getCurrentStatus(sessionId: string) {
  const supabase = createClient()
  console.log('Getting status for session:', sessionId)
  
  try {
    const { data: session, error } = await supabase
      .from('otis_workflow_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (error) throw error

    return {
      currentStage: session.current_stage,
      status: session.status,
      lastUpdated: session.updated_at
    }
  } catch (error) {
    console.error('Error getting status:', error)
    return {
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
} 