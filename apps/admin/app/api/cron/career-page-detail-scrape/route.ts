// @auth SECRET
// apps/admin/app/api/cron/career-page-detail-scrape/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAutomationMonitoring } from '@/lib/automation-monitor'
import { run } from '@/lib/automations/career-page-detail-scrape'

async function handler(_req: NextRequest) {
  const result = await run()
  return NextResponse.json({
    success: result.success,
    stats: result.stats,
    error: result.error,
    message: result.success ? 'completed' : 'failed',
  }, { status: result.success ? 200 : 500 })
}

export const POST = withAutomationMonitoring('career-page-detail-scrape')(handler)
export const GET = POST  // Vercel Cron stuurt GET
export const runtime = 'nodejs'
export const preferredRegion = ['fra1', 'ams1']
export const maxDuration = 300
