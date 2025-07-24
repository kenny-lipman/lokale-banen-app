import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { OtisErrorHandler } from '@/lib/error-handler'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body, null, 2))
    
    // Handle both direct webhook calls and n8n webhook format
    let apify_run_id, session_id, status, job_count, error_message
    
    if (Array.isArray(body)) {
      // n8n webhook format - extract from first item
      const webhookData = body[0]
      apify_run_id = webhookData.id
      session_id = webhookData.session_id || webhookData.body?.session_id
      status = webhookData.status
      job_count = webhookData.job_count
      error_message = webhookData.status_message
    } else {
      // Direct webhook format
      apify_run_id = body.apify_run_id
      session_id = body.session_id
      status = body.status
      job_count = body.job_count
      error_message = body.error_message
    }
    
    console.log('Processed webhook data:', { apify_run_id, session_id, status, job_count })
    
    // Validate required fields
    if (!apify_run_id || !session_id) {
      console.error('Missing required fields in webhook:', { apify_run_id, session_id })
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: apify_run_id, session_id' 
      }, { status: 400 })
    }

    const supabase = createClient()
    
    // Update apify_runs table with session_id
    const { error: apifyError } = await supabase
      .from('apify_runs')
      .update({ 
        session_id: session_id,
        status: status || 'SUCCEEDED',
        finished_at: new Date().toISOString()
      })
      .eq('id', apify_run_id)

    if (apifyError) {
      console.error('Error updating apify_runs:', apifyError)
      throw apifyError
    }

    // Note: We no longer update otis_workflow_sessions since we removed session management
    // The apify_runs table now tracks everything we need
    console.log('Apify run updated successfully - no session update needed')

    console.log(`Webhook processed successfully: session_id=${session_id}, apify_run_id=${apify_run_id}, status=${status}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully',
      session_id,
      apify_run_id,
      status
    })

  } catch (error) {
    console.error('Webhook error:', error)
    const handledError = OtisErrorHandler.handle(error, 'apify_webhook')
    return NextResponse.json(handledError, { status: 500 })
  }
} 