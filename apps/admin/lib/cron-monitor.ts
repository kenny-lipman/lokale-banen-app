/**
 * Cron Job Monitoring Wrapper
 *
 * Higher-order function that wraps cron handlers with automatic logging
 * to the cron_job_logs table. Includes auth via withCronAuth internally.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Re-export shared config so server-side imports from cron-monitor still work
export { CRON_JOBS_CONFIG, EXPECTED_INTERVAL_MS, OVERDUE_MULTIPLIER, ALERT_COOLDOWN_HOURS } from '@/lib/cron-config'

/** Timeout threshold — Vercel Pro maxDuration is 300s, mark as timeout if >= 290s */
const TIMEOUT_THRESHOLD_MS = 290_000

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function logCronExecution(params: {
  jobName: string
  path: string
  status: 'success' | 'error' | 'timeout'
  durationMs: number
  httpStatus?: number
  errorMessage?: string
  responseSummary?: Record<string, unknown>
  startedAt: Date
}) {
  try {
    const supabase = getServiceClient()
    const { error } = await supabase.from('cron_job_logs').insert({
      job_name: params.jobName,
      path: params.path,
      status: params.status,
      duration_ms: params.durationMs,
      http_status: params.httpStatus ?? null,
      error_message: params.errorMessage ?? null,
      response_summary: params.responseSummary ?? null,
      started_at: params.startedAt.toISOString(),
    })
    if (error) {
      console.error(`[cron-monitor] Supabase insert error for ${params.jobName}:`, error.message)
    }
  } catch (err) {
    console.error(`[cron-monitor] Failed to log execution for ${params.jobName}:`, err)
  }
}

/**
 * Wraps a cron handler with monitoring + auth.
 * Replaces `withCronAuth` — auth is handled internally.
 */
export function withCronMonitoring(
  jobName: string,
  path: string
) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    const monitoredHandler = async (req: NextRequest): Promise<NextResponse> => {
      const startedAt = new Date()
      const startTime = Date.now()

      try {
        const response = await handler(req)
        const durationMs = Date.now() - startTime

        // Try to extract a summary from the response body
        let responseSummary: Record<string, unknown> | undefined
        let errorMessage: string | undefined
        try {
          const cloned = response.clone()
          const body = await cloned.json()
          const { stats, message, success, duration, error: bodyError } = body as Record<string, unknown>
          responseSummary = { stats, message, success, duration }
          // Extract error message from response body (handlers catch errors internally)
          if (!success || bodyError) {
            errorMessage = (bodyError ?? message ?? 'Unknown error') as string
          }
        } catch {
          // Response may not be JSON
        }

        // Determine status: timeout > error (http 4xx/5xx or success:false in body) > success
        let status: 'success' | 'error' | 'timeout'
        if (durationMs >= TIMEOUT_THRESHOLD_MS) {
          status = 'timeout'
        } else if (response.status >= 400 || errorMessage) {
          status = 'error'
        } else {
          status = 'success'
        }

        await logCronExecution({
          jobName,
          path,
          status,
          durationMs,
          httpStatus: response.status,
          errorMessage,
          responseSummary,
          startedAt,
        })

        return response
      } catch (err) {
        const durationMs = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'

        await logCronExecution({
          jobName,
          path,
          status: durationMs >= TIMEOUT_THRESHOLD_MS ? 'timeout' : 'error',
          durationMs,
          httpStatus: 500,
          errorMessage,
          startedAt,
        })

        throw err
      }
    }

    return withCronAuth(monitoredHandler)
  }
}
