/**
 * Cron Job: Refresh Campaign Eligible Companies
 *
 * Refreshes the materialized view of companies eligible for campaign assignment.
 * Previously ran as a direct SQL pg_cron job, now wrapped as an API endpoint for Vercel Cron.
 *
 * Schedule: Daily at 06:30 UTC
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { createClient } from '@supabase/supabase-js'

async function refreshHandler(_request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log(`Refreshing campaign eligible companies at ${new Date().toISOString()}`)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase.rpc('refresh_campaign_eligible_companies')

    if (error) {
      throw new Error(`RPC failed: ${error.message}`)
    }

    const duration = Date.now() - startTime
    console.log(`Campaign eligible refresh completed in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: 'Campaign eligible companies refreshed',
      duration,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error refreshing campaign eligible companies:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

// GET for Vercel Cron, POST for manual triggers
const monitored = withCronMonitoring('refresh-campaign-eligible', '/api/cron/refresh-campaign-eligible')
export const GET = monitored(refreshHandler)
export const POST = monitored(refreshHandler)
