/**
 * Cron Watchdog
 *
 * Runs every 15 minutes. Checks if all cron jobs are running on schedule.
 * Sends Slack alerts for overdue jobs and recovery notifications.
 *
 * Schedule: every 15 minutes
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring, CRON_JOBS_CONFIG, EXPECTED_INTERVAL_MS, OVERDUE_MULTIPLIER, ALERT_COOLDOWN_HOURS } from '@/lib/cron-monitor'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`
  return `${(ms / 3_600_000).toFixed(1)} uur`
}

function formatExpectedInterval(ms: number): string {
  if (ms < 60_000) return `elke ${ms / 1000}s`
  if (ms < 3_600_000) return `elke ${ms / 60_000} min`
  if (ms === 24 * 3_600_000) return 'dagelijks'
  return `elke ${(ms / 3_600_000).toFixed(1)} uur`
}

interface OverdueJob {
  name: string
  elapsed: number
  expectedMs: number
  lastRun: string
  lastStatus: string
}

async function sendSlackAlert(
  webhookUrl: string,
  overdueJobs: OverdueJob[],
  recoveredJobs: string[]
) {
  const blocks: Array<Record<string, unknown>> = []

  if (overdueJobs.length > 0) {
    const jobLines = overdueJobs.map(j =>
      `*${j.name}*\n  Laatste run: ${formatMs(j.elapsed)} geleden (verwacht: ${formatExpectedInterval(j.expectedMs)})\n  Laatste status: ${j.lastStatus}`
    ).join('\n\n')

    blocks.push(
      {
        type: 'header',
        text: { type: 'plain_text', text: `\u26a0\ufe0f ${overdueJobs.length} cron job(s) overdue` }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: jobLines }
      }
    )
  }

  if (recoveredJobs.length > 0) {
    blocks.push(
      {
        type: 'header',
        text: { type: 'plain_text', text: `\u2705 ${recoveredJobs.length} cron job(s) hersteld` }
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: recoveredJobs.map(n => `*${n}* draait weer normaal`).join('\n') }
      }
    )
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `Watchdog check: ${new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}` }]
  })

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
    if (!resp.ok) {
      console.error(`[watchdog] Slack webhook failed: ${resp.status} ${resp.statusText}`)
    }
  } catch (err) {
    console.error('[watchdog] Slack webhook error:', err)
  }
}

async function watchdogHandler(_request: NextRequest) {
  const startTime = Date.now()
  const supabase = getServiceClient()

  try {
    // 1. Get absolute latest run per job (no date filter)
    const { data: allRuns, error: runsError } = await supabase
      .from('cron_job_logs')
      .select('job_name, started_at, status')
      .order('job_name')
      .order('started_at', { ascending: false })
      .limit(200)

    if (runsError) {
      throw new Error(`Failed to fetch latest runs: ${runsError.message}`)
    }

    // Deduplicate to latest per job
    const latestByJob: Record<string, { started_at: string; status: string }> = {}
    for (const run of allRuns ?? []) {
      if (!latestByJob[run.job_name]) {
        latestByJob[run.job_name] = run
      }
    }

    // 2. Determine overdue and healthy jobs
    const now = Date.now()
    const overdueJobs: OverdueJob[] = []
    const healthyJobNames: string[] = []

    for (const [name, expectedMs] of Object.entries(EXPECTED_INTERVAL_MS)) {
      const latest = latestByJob[name]
      if (!latest) continue // no data yet — skip, not alertable

      const elapsed = now - new Date(latest.started_at).getTime()
      if (elapsed > expectedMs * OVERDUE_MULTIPLIER) {
        overdueJobs.push({
          name,
          elapsed,
          expectedMs,
          lastRun: latest.started_at,
          lastStatus: latest.status,
        })
      } else {
        healthyJobNames.push(name)
      }
    }

    // 3. Check recent alerts for deduplication
    const cooldownSince = new Date(now - ALERT_COOLDOWN_HOURS * 3_600_000).toISOString()
    const { data: recentAlerts } = await supabase
      .from('cron_watchdog_alerts')
      .select('job_name, alert_type')
      .gte('created_at', cooldownSince)

    const recentOverdueAlerts = new Set(
      (recentAlerts ?? []).filter(a => a.alert_type === 'overdue').map(a => a.job_name)
    )
    const recentRecoveredAlerts = new Set(
      (recentAlerts ?? []).filter(a => a.alert_type === 'recovered').map(a => a.job_name)
    )

    // 4. Filter: only alert for NEW overdue jobs (not already alerted)
    const newOverdue = overdueJobs.filter(j => !recentOverdueAlerts.has(j.name))

    // 5. Filter: only alert for RECOVERED jobs (were alerted as overdue, now healthy, not already recovery-alerted)
    const recoveredJobs = healthyJobNames.filter(
      name => recentOverdueAlerts.has(name) && !recentRecoveredAlerts.has(name)
    )

    // 6. Send Slack alert if there's anything to report
    const slackUrl = process.env.WATCHDOG_SLACK_WEBHOOK_URL
    if (slackUrl && (newOverdue.length > 0 || recoveredJobs.length > 0)) {
      await sendSlackAlert(slackUrl, newOverdue, recoveredJobs)
    }

    // 7. Log alerts to DB
    const alertInserts: Array<{ job_name: string; alert_type: string; message: string }> = []

    for (const job of newOverdue) {
      alertInserts.push({
        job_name: job.name,
        alert_type: 'overdue',
        message: `Job ${job.name} niet gedraaid sinds ${formatMs(job.elapsed)} (verwacht: ${formatExpectedInterval(job.expectedMs)})`,
      })
    }
    for (const name of recoveredJobs) {
      alertInserts.push({
        job_name: name,
        alert_type: 'recovered',
        message: `Job ${name} draait weer normaal`,
      })
    }

    if (alertInserts.length > 0) {
      const { error: insertError } = await supabase.from('cron_watchdog_alerts').insert(alertInserts)
      if (insertError) {
        console.error('[watchdog] Failed to insert alerts:', insertError.message)
      }
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: overdueJobs.length === 0 ? 'All jobs healthy' : `${overdueJobs.length} job(s) overdue`,
      stats: {
        totalMonitored: Object.keys(EXPECTED_INTERVAL_MS).length,
        healthy: healthyJobNames.length,
        overdue: overdueJobs.length,
        newAlertsSent: newOverdue.length,
        recoveriesSent: recoveredJobs.length,
        noData: Object.keys(EXPECTED_INTERVAL_MS).length - healthyJobNames.length - overdueJobs.length,
      },
      overdueJobs: overdueJobs.map(j => ({
        name: j.name,
        elapsedFormatted: formatMs(j.elapsed),
        expectedFormatted: formatExpectedInterval(j.expectedMs),
        lastStatus: j.lastStatus,
      })),
      duration,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[watchdog] Error:', errorMessage)

    // Try to send Slack alert about watchdog itself failing
    const slackUrl = process.env.WATCHDOG_SLACK_WEBHOOK_URL
    if (slackUrl) {
      try {
        await fetch(slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blocks: [{
              type: 'header',
              text: { type: 'plain_text', text: '\ud83d\udea8 Watchdog zelf gefaald!' }
            }, {
              type: 'section',
              text: { type: 'mrkdwn', text: `Error: ${errorMessage}` }
            }]
          }),
        })
      } catch {
        // Best effort
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }, { status: 500 })
  }
}

const monitored = withCronMonitoring('watchdog', '/api/cron/watchdog')
export const GET = monitored(watchdogHandler)
export const POST = monitored(watchdogHandler)
