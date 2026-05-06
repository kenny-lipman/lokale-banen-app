// apps/admin/lib/automation-monitor.ts

import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_THRESHOLD_MS = 290_000

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface InsertRunParams {
  automationId: string
  startedAt: Date
  triggeredBy: 'schedule' | 'manual'
  triggeredByUserId: string | null
}

async function insertRunningRow(p: InsertRunParams): Promise<string | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('automation_runs')
    .insert({
      automation_id: p.automationId,
      started_at: p.startedAt.toISOString(),
      status: 'running',
      triggered_by: p.triggeredBy,
      triggered_by_user_id: p.triggeredByUserId,
    })
    .select('id')
    .single()
  if (error) {
    console.error(`[automation-monitor] Insert running failed for ${p.automationId}:`, error.message)
    return null
  }
  return data.id
}

interface UpdateRunParams {
  runId: string
  status: 'success' | 'error' | 'timeout'
  durationMs: number
  httpStatus?: number
  errorMessage?: string
  businessStats?: Record<string, unknown>
  completedAt: Date
}

async function updateRunRow(p: UpdateRunParams) {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('automation_runs')
    .update({
      completed_at: p.completedAt.toISOString(),
      duration_ms: p.durationMs,
      status: p.status,
      http_status: p.httpStatus ?? null,
      error_message: p.errorMessage ?? null,
      business_stats: p.businessStats ?? null,
    })
    .eq('id', p.runId)
  if (error) {
    console.error(`[automation-monitor] Update run ${p.runId} failed:`, error.message)
  }
}

/**
 * Wrapt een handler met:
 * - withCronAuth (CRON_SECRET) — geldt voor zowel scheduled als manual triggers
 * - Insert 'running' row → run handler → update row met resultaat
 * - Trigger-source via headers: X-Automation-Trigger (manual/schedule), X-Automation-User-Id
 */
export function withAutomationMonitoring(automationId: string) {
  return (handler: (req: NextRequest) => Promise<NextResponse>) => {
    const monitored = async (req: NextRequest): Promise<NextResponse> => {
      const startedAt = new Date()
      const startTime = Date.now()
      const triggeredBy = (req.headers.get('x-automation-trigger') === 'manual')
        ? 'manual' as const
        : 'schedule' as const
      const triggeredByUserId = req.headers.get('x-automation-user-id')

      const runId = await insertRunningRow({ automationId, startedAt, triggeredBy, triggeredByUserId })

      try {
        const response = await handler(req)
        const durationMs = Date.now() - startTime

        let businessStats: Record<string, unknown> | undefined
        let errorMessage: string | undefined
        try {
          const cloned = response.clone()
          const body = await cloned.json()
          const { stats, message, success, error: bodyError } = body as Record<string, unknown>
          if (stats && typeof stats === 'object') {
            businessStats = stats as Record<string, unknown>
          }
          if (!success || bodyError) {
            errorMessage = (bodyError ?? message ?? 'Unknown error') as string
          }
        } catch {
          // Response may not be JSON
        }

        const status: 'success' | 'error' | 'timeout' =
          durationMs >= TIMEOUT_THRESHOLD_MS ? 'timeout'
          : (response.status >= 400 || errorMessage) ? 'error'
          : 'success'

        if (runId) {
          await updateRunRow({
            runId, status, durationMs,
            httpStatus: response.status,
            errorMessage, businessStats,
            completedAt: new Date(),
          })
        }
        return response
      } catch (err) {
        const durationMs = Date.now() - startTime
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        if (runId) {
          await updateRunRow({
            runId,
            status: durationMs >= TIMEOUT_THRESHOLD_MS ? 'timeout' : 'error',
            durationMs,
            httpStatus: 500,
            errorMessage,
            completedAt: new Date(),
          })
        }
        throw err
      }
    }

    return withCronAuth(monitored)
  }
}
