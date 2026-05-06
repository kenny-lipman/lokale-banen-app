// apps/admin/app/api/automations/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { AUTOMATIONS } from '@/lib/automations-registry'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function listHandler(request: NextRequest, _auth: AuthResult) {
  try {
    const { searchParams } = request.nextUrl
    const rawDays = parseInt(searchParams.get('days') || '7', 10)
    const days = Math.max(1, Math.min(Number.isNaN(rawDays) ? 7 : rawDays, 30))

    const supabase = getServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    // Stats per automation via RPC
    const { data: statsRows } = await supabase.rpc('get_automation_run_stats', {
      since_date: sinceISO,
      filter_automation_id: '',
    })

    const statsByAutomation: Record<string, {
      totalRuns: number; successCount: number; errorCount: number; timeoutCount: number;
      avgDurationMs: number; maxDurationMs: number; successRate: number
    }> = {}
    for (const row of statsRows ?? []) {
      const total = Number(row.total_runs)
      statsByAutomation[row.automation_id] = {
        totalRuns: total,
        successCount: Number(row.success_count),
        errorCount: Number(row.error_count),
        timeoutCount: Number(row.timeout_count),
        avgDurationMs: Math.round(Number(row.avg_duration_ms)),
        maxDurationMs: Number(row.max_duration_ms),
        successRate: total > 0 ? Math.round((Number(row.success_count) / total) * 100) : 0,
      }
    }

    // Latest run per automation: pak laatste 200 runs en dedup
    const { data: recentRuns } = await supabase
      .from('automation_runs')
      .select('*')
      .order('automation_id')
      .order('started_at', { ascending: false })
      .limit(200)

    const latestByAutomation: Record<string, NonNullable<typeof recentRuns>[number]> = {}
    for (const run of recentRuns ?? []) {
      if (!latestByAutomation[run.automation_id]) {
        latestByAutomation[run.automation_id] = run
      }
    }

    const automations = AUTOMATIONS.map((a) => ({
      ...a,
      latestRun: latestByAutomation[a.id] ?? null,
      stats: statsByAutomation[a.id] ?? null,
    }))

    return NextResponse.json({
      success: true,
      days,
      automations,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching automations:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export const GET = withAuth(listHandler)
