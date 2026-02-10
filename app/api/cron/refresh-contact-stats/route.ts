/**
 * Cron Job: Refresh Contact Stats Materialized View
 *
 * Refreshes the contact_stats materialized view for dashboard performance.
 * Previously ran as a direct SQL pg_cron job, now wrapped as an API endpoint for Vercel Cron.
 *
 * Schedule: Every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { createClient } from '@supabase/supabase-js'

async function refreshHandler(_request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase.rpc('refresh_contact_stats_mv')

    if (error) {
      throw new Error(`RPC failed: ${error.message}`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Contact stats refreshed',
      duration,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error refreshing contact stats:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

// GET for Vercel Cron, POST for manual triggers
const monitored = withCronMonitoring('refresh-contact-stats', '/api/cron/refresh-contact-stats')
export const GET = monitored(refreshHandler)
export const POST = monitored(refreshHandler)
