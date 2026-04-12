import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { OtisErrorHandler } from '@/lib/error-handler'
import { withWebhookSecurity, checkWebhookRateLimit } from '@/lib/webhook-security'

async function n8nWebhookHandler(req: NextRequest, payload: any) {
  try {
    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    if (!checkWebhookRateLimit(`n8n-${clientIP}`, 50, 15)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded'
      }, { status: 429 })
    }

    // Use the validated payload from webhook security middleware
    const body = payload
    console.log('n8n Apify completion webhook received:', JSON.stringify(body, null, 2))
    
    // Extract data from n8n webhook format
    const { apify_run_id, session_id, status, job_count, companies_found } = body
    
    console.log('Processing completion webhook:', { apify_run_id, session_id, status, job_count, companies_found })
    
    // Validate required fields
    if (!apify_run_id || !session_id) {
      console.error('Missing required fields in completion webhook:', { apify_run_id, session_id })
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: apify_run_id, session_id' 
      }, { status: 400 })
    }

    const supabase = createClient()
    
    // Update apify_runs table with session_id and completion status
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

    // Update otis_workflow_sessions with scraping results
    const updateData: any = {
      apify_run_id: apify_run_id,
      scraping_status: status === 'SUCCEEDED' ? 'completed' : 'failed',
      updated_at: new Date().toISOString()
    }

    if (status === 'SUCCEEDED') {
      updateData.scraping_completed_at = new Date().toISOString()
      updateData.job_count = job_count || 0
    }

    const { error: sessionError } = await supabase
      .from('otis_workflow_sessions')
      .update(updateData)
      .eq('session_id', session_id)

    if (sessionError) {
      console.error('Error updating session:', sessionError)
      throw sessionError
    }

    console.log(`Completion webhook processed successfully: session_id=${session_id}, apify_run_id=${apify_run_id}, status=${status}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Completion webhook processed successfully',
      session_id,
      apify_run_id,
      status,
      job_count,
      companies_found
    })

  } catch (error) {
    console.error('Completion webhook error:', error)
    const handledError = OtisErrorHandler.handle(error, 'n8n_apify_complete')
    return NextResponse.json(handledError, { status: 500 })
  }
}

// Export the secured webhook handler
export const POST = withWebhookSecurity('n8n', n8nWebhookHandler, {
  requireSignature: true,
  requireTimestamp: false
}) 