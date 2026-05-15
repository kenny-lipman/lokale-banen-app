// apps/admin/app/api/automations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getAutomation } from '@/lib/automations-registry'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function detailHandler(
  request: NextRequest,
  _auth: AuthResult,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const automation = getAutomation(id)
    if (!automation) {
      return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 })
    }

    const { searchParams } = request.nextUrl
    const rawDays = parseInt(searchParams.get('days') || '30', 10)
    const days = Math.max(1, Math.min(Number.isNaN(rawDays) ? 30 : rawDays, 90))

    const supabase = getServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    // Stats
    const { data: statsRows } = await supabase.rpc('get_automation_run_stats', {
      since_date: sinceISO,
      filter_automation_id: id,
    })
    const row = statsRows?.[0]
    const stats = row ? {
      totalRuns: Number(row.total_runs),
      successCount: Number(row.success_count),
      errorCount: Number(row.error_count),
      timeoutCount: Number(row.timeout_count),
      avgDurationMs: Math.round(Number(row.avg_duration_ms)),
      maxDurationMs: Number(row.max_duration_ms),
      successRate: Number(row.total_runs) > 0
        ? Math.round((Number(row.success_count) / Number(row.total_runs)) * 100)
        : 0,
    } : null

    // Run history (laatste 100)
    const { data: runs } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('automation_id', id)
      .order('started_at', { ascending: false })
      .limit(100)

    return NextResponse.json({
      success: true,
      automation,
      stats,
      runs: runs ?? [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching automation detail:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export const GET = withAuth(detailHandler)
