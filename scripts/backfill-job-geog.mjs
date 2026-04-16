/**
 * Fase 3 — backfill job_postings.geog from text latitude/longitude
 * Calls server-side RPC `backfill_job_geog_batch(batch_size)` in a loop.
 *
 * Safe properties:
 *   - Idempotent: only rows with geog IS NULL AND geog_invalid=false are picked up.
 *   - NL-coord validated (lat 50.5..53.7, lng 3.3..7.3); invalid rows marked geog_invalid=TRUE.
 *   - Skip-locked, so multiple runs won't double-process.
 *   - Logs every 10 batches to stdout + backfill-geog.log
 *
 * Run: node scripts/backfill-job-geog.mjs [batch_size] [max_batches]
 *   batch_size  default 5000
 *   max_batches default Infinity (runs until nothing left)
 */

import { readFileSync, appendFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
    .filter(([k, v]) => k && v)
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const BATCH_SIZE = Number(process.argv[2] || 5000)
const MAX_BATCHES = Number(process.argv[3] || Infinity)
const LOG_PATH = resolve(process.cwd(), 'backfill-geog.log')
const BATCH_DELAY_MS = 150 // gentle throttle between batches

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try { appendFileSync(LOG_PATH, line + '\n') } catch {}
}

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`RPC ${fn} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function stats() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/job_postings?select=count&geog=not.is.null`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' } }
  )
  const rangeHeader = res.headers.get('content-range') || ''
  const total = Number(rangeHeader.split('/')[1] || 0)
  return total
}

async function main() {
  log(`Starting backfill — batch_size=${BATCH_SIZE} max_batches=${MAX_BATCHES}`)
  const before = await stats()
  log(`Rows with geog NOT NULL before: ${before.toLocaleString()}`)

  let batchNum = 0
  let totalProcessed = 0
  let totalFilled = 0
  let totalSkipped = 0
  const t0 = Date.now()

  while (batchNum < MAX_BATCHES) {
    batchNum += 1
    try {
      const result = await rpc('backfill_job_geog_batch', { batch_size: BATCH_SIZE })
      // result is an array with one row: [{ processed, filled, skipped }]
      const row = Array.isArray(result) ? result[0] : result
      const processed = row?.processed ?? 0
      const filled = row?.filled ?? 0
      const skipped = row?.skipped ?? 0

      totalProcessed += processed
      totalFilled += filled
      totalSkipped += skipped

      if (processed === 0) {
        log(`Batch ${batchNum}: 0 candidates — done.`)
        break
      }

      if (batchNum % 10 === 0 || processed < BATCH_SIZE) {
        const secs = (Date.now() - t0) / 1000
        const rate = totalProcessed / Math.max(secs, 0.001)
        log(
          `Batch ${batchNum}: processed=${processed} filled=${filled} skipped=${skipped} ` +
          `| cumulative processed=${totalProcessed.toLocaleString()} filled=${totalFilled.toLocaleString()} skipped=${totalSkipped.toLocaleString()} ` +
          `| ${rate.toFixed(0)} rows/s`
        )
      }

      await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
    } catch (err) {
      log(`Batch ${batchNum} ERROR: ${err.message}`)
      // brief backoff then continue
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  const after = await stats()
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  log(`Done in ${secs}s — processed=${totalProcessed.toLocaleString()} filled=${totalFilled.toLocaleString()} skipped=${totalSkipped.toLocaleString()}`)
  log(`Rows with geog NOT NULL after: ${after.toLocaleString()} (delta +${(after - before).toLocaleString()})`)
}

main().catch(err => { log(`FATAL: ${err.stack || err.message}`); process.exit(1) })
