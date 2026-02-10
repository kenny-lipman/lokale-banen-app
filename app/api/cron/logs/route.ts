/**
 * API Route: Cron Job Logs
 *
 * GET /api/cron/logs - Fetch cron job execution logs for the dashboard
 *
 * Query params:
 * - days (default 7) — how many days back for stats
 * - job_name (optional) — filter by specific job
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { CRON_JOBS_CONFIG } from '@/lib/cron-monitor'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function logsHandler(request: NextRequest, _authResult: AuthResult) {
  try {
    const { searchParams } = request.nextUrl
    const rawDays = parseInt(searchParams.get('days') || '7', 10)
    const days = Math.max(1, Math.min(Number.isNaN(rawDays) ? 7 : rawDays, 30))
    const jobName = searchParams.get('job_name')

    const supabase = getServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceISO = since.toISOString()

    // 1. Get aggregated stats per job via SQL (handles high-frequency jobs efficiently)
    const { data: statsRows, error: statsError } = await supabase.rpc('get_cron_job_stats', {
      since_date: sinceISO,
      filter_job_name: jobName ?? '',
    })

    // Fallback: if the RPC doesn't exist yet, compute stats from a limited query
    let statsByJob: Record<string, {
      totalRuns: number
      successCount: number
      errorCount: number
      timeoutCount: number
      avgDurationMs: number
      maxDurationMs: number
      successRate: number
    }> = {}

    if (statsError) {
      // RPC not available — fallback to client-side aggregation with higher limit
      const { data: fallbackLogs } = await supabase
        .from('cron_job_logs')
        .select('job_name, status, duration_ms')
        .gte('started_at', sinceISO)
        .order('started_at', { ascending: false })
        .limit(10000)

      for (const log of fallbackLogs ?? []) {
        if (jobName && log.job_name !== jobName) continue
        if (!statsByJob[log.job_name]) {
          statsByJob[log.job_name] = {
            totalRuns: 0, successCount: 0, errorCount: 0, timeoutCount: 0,
            avgDurationMs: 0, maxDurationMs: 0, successRate: 0,
          }
        }
        const s = statsByJob[log.job_name]
        s.totalRuns++
        if (log.status === 'success') s.successCount++
        if (log.status === 'error') s.errorCount++
        if (log.status === 'timeout') s.timeoutCount++
        s.avgDurationMs += log.duration_ms
        if (log.duration_ms > s.maxDurationMs) s.maxDurationMs = log.duration_ms
      }

      for (const s of Object.values(statsByJob)) {
        s.avgDurationMs = s.totalRuns > 0 ? Math.round(s.avgDurationMs / s.totalRuns) : 0
        s.successRate = s.totalRuns > 0 ? Math.round((s.successCount / s.totalRuns) * 100) : 0
      }
    } else {
      // Map RPC results
      for (const row of statsRows ?? []) {
        statsByJob[row.job_name] = {
          totalRuns: row.total_runs,
          successCount: row.success_count,
          errorCount: row.error_count,
          timeoutCount: row.timeout_count,
          avgDurationMs: Math.round(row.avg_duration_ms),
          maxDurationMs: row.max_duration_ms,
          successRate: row.total_runs > 0
            ? Math.round((row.success_count / row.total_runs) * 100)
            : 0,
        }
      }
    }

    // 2. Get absolute latest run per job (NO date filter — detect stale/broken jobs)
    let latestQuery = supabase
      .from('cron_job_logs')
      .select('*')
      .order('job_name')
      .order('started_at', { ascending: false })
      .limit(100)

    if (jobName) {
      latestQuery = latestQuery.eq('job_name', jobName)
    }

    const { data: recentLogs, error: recentError } = await latestQuery

    if (recentError) {
      throw new Error(`Failed to fetch recent logs: ${recentError.message}`)
    }

    // Deduplicate to latest per job (results are sorted by job_name, then started_at DESC)
    const latestByJob: Record<string, (typeof recentLogs)[0]> = {}
    for (const log of recentLogs ?? []) {
      if (!latestByJob[log.job_name]) {
        latestByJob[log.job_name] = log
      }
    }

    // 3. Build summary with config info for all known jobs
    const jobNames = jobName ? [jobName] : Object.keys(CRON_JOBS_CONFIG)
    const jobSummaries = jobNames
      .filter(name => CRON_JOBS_CONFIG[name])
      .map((name) => ({
        name,
        ...CRON_JOBS_CONFIG[name],
        latestRun: latestByJob[name] ?? null,
        stats: statsByJob[name] ?? null,
      }))

    // 4. Get recent logs for display (limited — only last 50 per job or 100 total)
    let logsQuery = supabase
      .from('cron_job_logs')
      .select('*')
      .gte('started_at', sinceISO)
      .order('started_at', { ascending: false })
      .limit(100)

    if (jobName) {
      logsQuery = logsQuery.eq('job_name', jobName)
    }

    const { data: logs } = await logsQuery

    return NextResponse.json({
      success: true,
      days,
      jobs: jobSummaries,
      logs: logs ?? [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching cron logs:', errorMessage)

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 })
  }
}

export const GET = withAuth(logsHandler)
