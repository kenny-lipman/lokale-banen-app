// apps/admin/lib/automations/fix-job-postings-geocoding/index.ts

import { createClient } from '@supabase/supabase-js'
import { searchCity } from './locationiq-client'
import { extractPostcodePrefix, findPlatformIdByPostcode } from './platform-lookup'
import { fetchQueueBatch, countQueueRemaining, type QueueRow } from './queue'
import { getApiCallsToday, isBudgetExhausted, DAILY_CAP } from './budget-check'
import type { BusinessStats } from './types'

const AUTOMATION_ID = 'fix-job-postings-geocoding'
const PER_RUN_LIMIT = 290
const ITEM_DELAY_MS = 1000           // 60 req/min sustained
const MAX_RUN_MS = 270_000           // 30s buffer onder 300s timeout
const RETRY_DELAY_MS = 2000          // backoff op rate_limit

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function deriveCity(row: QueueRow): string | null {
  if (row.city && row.city.trim()) return row.city.trim()
  if (row.location && typeof row.location === 'string' && !row.location.startsWith('{')) {
    return row.location.trim()
  }
  return null
}

export async function run(): Promise<{ stats: BusinessStats; success: boolean; error?: string }> {
  const supabase = getServiceClient()
  const apiKey = process.env.LOCATIONIQ_API_KEY
  if (!apiKey) {
    return {
      success: false, error: 'LOCATIONIQ_API_KEY not configured',
      stats: emptyStats({ skipped_reason: 'auth_failed' }),
    }
  }

  // Budget-check
  const callsToday = await getApiCallsToday(supabase, AUTOMATION_ID)
  if (isBudgetExhausted(callsToday, PER_RUN_LIMIT)) {
    return {
      success: true,
      stats: emptyStats({ skipped_reason: 'daily_budget_reached', api_calls_used: 0 }),
    }
  }

  const startTime = Date.now()
  const stats: BusinessStats = {
    processed: 0, enriched: 0,
    geocoding_failed_no_match: 0, geocoding_failed_no_postcode: 0,
    platform_matched: 0, queue_remaining: 0,
    api_calls_used: 0, stopped_early: false,
  }

  const queue = await fetchQueueBatch(supabase, PER_RUN_LIMIT)

  for (const row of queue) {
    if (Date.now() - startTime > MAX_RUN_MS) {
      stats.stopped_early = true
      break
    }

    stats.processed++

    const city = deriveCity(row)
    if (!city) {
      await markFailed(supabase, row.id, 'no_city')
      stats.geocoding_failed_no_match++
      continue
    }

    let outcome = await searchCity(city, { apiKey })
    stats.api_calls_used++

    if (!outcome.ok && outcome.reason === 'rate_limit') {
      await sleep(RETRY_DELAY_MS)
      outcome = await searchCity(city, { apiKey })
      stats.api_calls_used++
    }

    if (!outcome.ok && outcome.reason === 'auth_failed') {
      // Stop direct — geen verdere calls verspillen
      return { success: false, error: 'auth_failed', stats: { ...stats, skipped_reason: 'auth_failed' } }
    }

    if (!outcome.ok && outcome.reason === 'no_match') {
      await markFailed(supabase, row.id, 'no_match')
      stats.geocoding_failed_no_match++
      await sleep(ITEM_DELAY_MS)
      continue
    }

    if (!outcome.ok) {
      // http_error — log, ga door zonder markFailed (kan tijdelijk zijn)
      console.warn(`[geocoding] http_error voor ${row.id}:`, outcome.message)
      await sleep(ITEM_DELAY_MS)
      continue
    }

    const addr = outcome.result.address
    const postcode = addr.postcode ?? null
    if (!postcode) {
      await markFailed(supabase, row.id, 'missing_postcode')
      stats.geocoding_failed_no_postcode++
      await sleep(ITEM_DELAY_MS)
      continue
    }

    const prefix = extractPostcodePrefix(postcode)
    let platformId: string | null = null
    if (prefix) {
      platformId = await findPlatformIdByPostcode(supabase, prefix)
      if (platformId) stats.platform_matched++
    }

    const { error: updateErr } = await supabase
      .from('job_postings')
      .update({
        street: addr.road ?? null,
        zipcode: postcode,
        latitude: parseFloat(outcome.result.lat),
        longitude: parseFloat(outcome.result.lon),
        city: addr.city ?? addr.town ?? addr.village ?? null,
        country: addr.country_code ?? null,
        state: addr.state ?? null,
        platform_id: platformId,
      })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`[geocoding] update ${row.id} failed:`, updateErr.message)
    } else {
      stats.enriched++
    }

    await sleep(ITEM_DELAY_MS)
  }

  stats.queue_remaining = await countQueueRemaining(supabase)

  return { success: true, stats }
}

async function markFailed(
  supabase: ReturnType<typeof getServiceClient>,
  id: string,
  reason: string,
) {
  const { error } = await supabase
    .from('job_postings')
    .update({ geocoding_failed: true, geocoding_failed_reason: reason })
    .eq('id', id)
  if (error) console.error(`[geocoding] markFailed ${id}:`, error.message)
}

function emptyStats(over: Partial<BusinessStats>): BusinessStats {
  return {
    processed: 0, enriched: 0,
    geocoding_failed_no_match: 0, geocoding_failed_no_postcode: 0,
    platform_matched: 0, queue_remaining: 0,
    api_calls_used: 0, stopped_early: false,
    ...over,
  }
}
