/**
 * Cron Job: Refresh Company Platforms Materialized View
 *
 * Refreshes mv_company_platforms — de M2M mapping tussen companies en platforms,
 * gebruikt door de platform-filter op /contacten voor bulk Pipedrive/Instantly sync.
 *
 * Schedule: dagelijks 10:00 UTC (na n8n workflow "Fix Platform_id Nominatim" @ 09:00 Europe/Amsterdam).
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

    const { error } = await supabase.rpc('refresh_company_platforms_mv')

    if (error) {
      throw new Error(`RPC failed: ${error.message}`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Company platforms MV refreshed',
      duration,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error refreshing company platforms MV:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}

const monitored = withCronMonitoring('refresh-company-platforms', '/api/cron/refresh-company-platforms')
export const GET = monitored(refreshHandler)
export const POST = monitored(refreshHandler)
