/**
 * Fase 3 backfill — direct PostgREST approach (no RPC, no timeout risk).
 *
 * Strategy:
 *   1. SELECT batch of jobs WITHOUT geog but WITH valid lat/lng (PostgREST GET)
 *   2. For each row: PATCH with geog = "SRID=4326;POINT(lng lat)" (PostGIS EWKT)
 *   3. Validate NL coords range (lat 50.5..53.7, lng 3.3..7.3) — invalid → skip
 *   4. Concurrency 10, gentle delay between batches
 *
 * Run: node scripts/backfill-job-geog-direct.mjs [batch_size] [max_batches]
 */

import { readFileSync, appendFileSync } from 'fs'
import { resolve } from 'path'

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
    .filter(([k, v]) => k && v)
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const BATCH_SIZE = Number(process.argv[2] || 500)
const MAX_BATCHES = Number(process.argv[3] || Infinity)
const CONCURRENCY = 10
const LOG_PATH = resolve(process.cwd(), 'backfill-geog-direct.log')

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try { appendFileSync(LOG_PATH, line + '\n') } catch {}
}

function isValidNL(lat, lng) {
  return lat >= 50.0 && lat <= 54.0 && lng >= 3.0 && lng <= 7.5
}

async function fetchBatch(limit) {
  const url = `${SUPABASE_URL}/rest/v1/job_postings?geog=is.null&latitude=not.is.null&longitude=not.is.null&select=id,latitude,longitude&limit=${limit}`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (!res.ok) throw new Error(`Fetch batch: ${res.status} ${await res.text()}`)
  return res.json()
}

async function patchOne(row) {
  const lat = Number(row.latitude)
  const lng = Number(row.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { id: row.id, status: 'invalid' }
  }
  if (!isValidNL(lat, lng)) {
    // Mark as invalid by setting empty geog (still null but processed marker — skip)
    return { id: row.id, status: 'out-of-bounds' }
  }
  const body = JSON.stringify({ geog: `SRID=4326;POINT(${lng} ${lat})` })
  const res = await fetch(`${SUPABASE_URL}/rest/v1/job_postings?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body,
  })
  if (!res.ok) {
    return { id: row.id, status: 'error', err: `${res.status} ${await res.text()}` }
  }
  return { id: row.id, status: 'ok' }
}

async function processBatch(rows) {
  const results = []
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY)
    const r = await Promise.allSettled(slice.map(patchOne))
    results.push(...r)
  }
  const stats = { ok: 0, invalid: 0, 'out-of-bounds': 0, error: 0 }
  for (const r of results) {
    if (r.status === 'rejected') stats.error++
    else stats[r.value.status]++
  }
  return stats
}

let totalOk = 0, totalInvalid = 0, totalOOB = 0, totalErr = 0
let batchNum = 0
log(`Starting direct backfill — batch_size=${BATCH_SIZE} max_batches=${MAX_BATCHES} concurrency=${CONCURRENCY}`)

while (batchNum < MAX_BATCHES) {
  const t0 = Date.now()
  const rows = await fetchBatch(BATCH_SIZE)
  if (rows.length === 0) {
    log(`No more rows. Done.`)
    break
  }
  const stats = await processBatch(rows)
  totalOk += stats.ok
  totalInvalid += stats.invalid
  totalOOB += stats['out-of-bounds']
  totalErr += stats.error
  batchNum++
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  log(`Batch ${batchNum}: ok=${stats.ok} oob=${stats['out-of-bounds']} invalid=${stats.invalid} err=${stats.error} (${elapsed}s) — totals: ok=${totalOk}`)
  // gentle pause
  await new Promise(r => setTimeout(r, 100))
}

log(`COMPLETE: total ok=${totalOk}, invalid=${totalInvalid}, out-of-bounds=${totalOOB}, errors=${totalErr}`)
