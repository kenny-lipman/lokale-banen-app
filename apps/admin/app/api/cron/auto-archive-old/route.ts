/**
 * Cron Job: Auto-archive Old Job Postings
 *
 * Roept auto_archive_old_postings(120, 2000) RPC herhaaldelijk aan tot 0
 * records overblijven. Slaat approved+gepubliceerde vacatures over zodat
 * live publieke pagina's niet stilletjes offline gaan door tijdsverloop.
 *
 * Schedule: dagelijks 03:00 UTC (= 04:00 NL winter, 05:00 NL zomer)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { createClient } from '@supabase/supabase-js'

const AGE_DAYS = 120
const BATCH_SIZE = 2000
// Hard cap zodat één run nooit meer dan 5 minuten draait. Vercel Pro
// maxDuration is 300s, en bij ~30s per batch passen er ~10 in dat budget.
// Wat overblijft pakt de volgende cron-run wel op.
const MAX_BATCHES_PER_RUN = 8

async function autoArchiveHandler(_request: NextRequest) {
  const startTime = Date.now()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let totalArchived = 0
  let batches = 0
  const errors: string[] = []

  for (let i = 0; i < MAX_BATCHES_PER_RUN; i++) {
    const { data, error } = await supabase.rpc('auto_archive_old_postings', {
      age_days: AGE_DAYS,
      batch_size: BATCH_SIZE,
    })

    if (error) {
      errors.push(error.message)
      console.error(`[auto-archive-old] batch ${i + 1} error:`, error.message)
      // Stop bij errors — volgende cron-run probeert opnieuw
      break
    }

    const count = Number(data) || 0
    totalArchived += count
    batches++

    if (count === 0) break // klaar
  }

  const durationMs = Date.now() - startTime

  return NextResponse.json({
    success: errors.length === 0,
    message: `Auto-archive completed: ${totalArchived} records in ${batches} batches`,
    archived: totalArchived,
    batches,
    age_days: AGE_DAYS,
    duration_ms: durationMs,
    errors: errors.length > 0 ? errors : undefined,
  })
}

const monitored = withCronMonitoring(
  'auto-archive-old',
  '/api/cron/auto-archive-old'
)
export const GET = monitored(autoArchiveHandler)
export const POST = monitored(autoArchiveHandler)
