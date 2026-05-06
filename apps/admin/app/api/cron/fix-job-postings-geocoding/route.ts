// apps/admin/app/api/cron/fix-job-postings-geocoding/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAutomationMonitoring } from '@/lib/automation-monitor'
import { run } from '@/lib/automations/fix-job-postings-geocoding'

async function handler(_req: NextRequest) {
  const result = await run()
  return NextResponse.json({
    success: result.success,
    stats: result.stats,
    error: result.error,
    message: result.success ? 'completed' : 'failed',
  }, { status: result.success ? 200 : 500 })
}

export const POST = withAutomationMonitoring('fix-job-postings-geocoding')(handler)
export const GET = POST  // Vercel Cron stuurt GET
export const maxDuration = 300
