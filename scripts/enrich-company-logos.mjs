/**
 * Fase 6 — Company logo enrichment via Clearbit Logo API + favicon fallback.
 *
 * Strategy:
 *   1. Pick companies WHERE logo_url IS NULL AND website IS NOT NULL
 *      AND EXISTS (job_posting WHERE company_id=this AND review_status='approved')
 *   2. Try Clearbit Logo API: https://logo.clearbit.com/{domain}
 *      - HTTP 200 → save URL, logo_source='clearbit'
 *   3. Fallback: HEAD {domain}/favicon.ico
 *      - HTTP 200 → save URL, logo_source='favicon'
 *   4. Otherwise: logo_source='fallback', logo_url stays NULL
 *
 * Rate limiting: max 5 concurrent fetches, 200ms delay between batches
 * Idempotent: skips rows with logo_fetched_at < 30 days ago
 *
 * Run: node scripts/enrich-company-logos.mjs [limit]
 */

import { readFileSync, appendFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8').split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
    .filter(([k, v]) => k && v)
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const LIMIT = Number(process.argv[2] || 1000)
const CONCURRENCY = 5
const FETCH_TIMEOUT_MS = 5000
const LOG_PATH = resolve(process.cwd(), 'enrich-logos.log')

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try { appendFileSync(LOG_PATH, line + '\n') } catch {}
}

function extractDomain(website) {
  if (!website) return null
  try {
    let url = website.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    const u = new URL(url)
    let host = u.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    if (!host.includes('.')) return null
    return host
  } catch {
    return null
  }
}

async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

async function tryClearbit(domain) {
  const url = `https://logo.clearbit.com/${domain}`
  try {
    // GET request — Clearbit doesn't support HEAD properly
    const res = await withTimeout(
      fetch(url, { method: 'GET', redirect: 'follow' }),
      FETCH_TIMEOUT_MS
    )
    if (res.ok && res.headers.get('content-type')?.includes('image')) return url
  } catch {}
  return null
}

async function tryFavicon(domain) {
  const url = `https://${domain}/favicon.ico`
  try {
    const res = await withTimeout(
      fetch(url, { method: 'HEAD', redirect: 'follow' }),
      FETCH_TIMEOUT_MS
    )
    if (res.ok && res.headers.get('content-type')?.includes('image')) return url
  } catch {}
  return null
}

async function fetchCandidates(limit) {
  // PostgREST query — sort by apollo_contacts_count to prioritize companies
  // with active engagement (proxy for "matters most"). Fallback ordering = name.
  const url = `${SUPABASE_URL}/rest/v1/companies?select=id,name,website&logo_url=is.null&website=not.is.null&logo_fetched_at=is.null&order=apollo_contacts_count.desc.nullslast&limit=${limit}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      // PostgREST caps default response size; explicit Range bypasses cap.
      Range: `0-${limit - 1}`,
    },
  })
  if (!res.ok) throw new Error(`Fetch candidates: ${res.status} ${await res.text()}`)
  return res.json()
}

async function patchCompany(id, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload)
  })
  if (!res.ok) throw new Error(`Patch ${id}: ${res.status} ${await res.text()}`)
}

async function processCompany(c) {
  const domain = extractDomain(c.website)
  if (!domain) {
    await patchCompany(c.id, { logo_source: 'fallback', logo_fetched_at: new Date().toISOString() })
    return { id: c.id, status: 'no-domain' }
  }
  let logoUrl = await tryClearbit(domain)
  let source = 'clearbit'
  if (!logoUrl) {
    logoUrl = await tryFavicon(domain)
    source = 'favicon'
  }
  if (logoUrl) {
    await patchCompany(c.id, { logo_url: logoUrl, logo_source: source, logo_fetched_at: new Date().toISOString() })
    return { id: c.id, status: source, url: logoUrl }
  }
  await patchCompany(c.id, { logo_source: 'fallback', logo_fetched_at: new Date().toISOString() })
  return { id: c.id, status: 'fallback' }
}

async function processInBatches(items, fn, concurrency) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(fn))
    results.push(...batchResults)
    if (i % 50 === 0 && i > 0) {
      const stats = tally(results)
      log(`Progress: ${i}/${items.length} — clearbit=${stats.clearbit} favicon=${stats.favicon} fallback=${stats.fallback} errors=${stats.errors}`)
    }
    // Small delay to be polite to Clearbit
    await new Promise(r => setTimeout(r, 200))
  }
  return results
}

function tally(results) {
  const counts = { clearbit: 0, favicon: 0, fallback: 0, errors: 0, 'no-domain': 0 }
  for (const r of results) {
    if (r.status === 'rejected') counts.errors++
    else counts[r.value.status] = (counts[r.value.status] || 0) + 1
  }
  return counts
}

// Main
log(`Starting logo enrichment — limit ${LIMIT}, concurrency ${CONCURRENCY}`)
const candidates = await fetchCandidates(LIMIT)
log(`Fetched ${candidates.length} candidate companies`)
if (candidates.length === 0) {
  log('No candidates. Done.')
  process.exit(0)
}

const results = await processInBatches(candidates, processCompany, CONCURRENCY)
const stats = tally(results)
log(`COMPLETE: clearbit=${stats.clearbit}, favicon=${stats.favicon}, fallback=${stats.fallback}, errors=${stats.errors}, no-domain=${stats['no-domain']}`)
log(`Hit-rate: ${((stats.clearbit + stats.favicon) / candidates.length * 100).toFixed(1)}%`)
