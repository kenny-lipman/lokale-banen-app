import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'

/**
 * Legacy trigger-automation endpoint.
 * The n8n webhook integration has been removed.
 * Daily scraping is now handled directly by the baanindebuurt and debanensite cron jobs.
 */

async function cronTriggerHandler(_request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Trigger automation endpoint is deprecated. Scrapers run via their own cron jobs.',
    timestamp: new Date().toISOString()
  })
}

async function cronHealthHandler(_request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'automation-cron'
  })
}

export const POST = withCronAuth(cronTriggerHandler)
export const GET = withCronAuth(cronHealthHandler)
