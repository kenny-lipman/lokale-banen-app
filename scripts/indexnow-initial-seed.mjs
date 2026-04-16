/**
 * IndexNow initial seed — submit all approved+published URLs per platform.
 *
 * Run:
 *   node scripts/indexnow-initial-seed.mjs [--dry-run] [--platform=<id>]
 *
 * Env vars loaded from apps/admin/.env.vercel.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Notes:
 * - Uses preview_domain (production .nl DNS not yet live).
 * - Skips platforms without indexnow_key or preview_domain/domain.
 * - Batches max 10,000 URLs per IndexNow request.
 * - IndexNow accepts the same key file we serve at /{key}.txt via /api/indexnow-key.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Env loading ───────────────────────────────────────────────────────────────

function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch (err) {
    console.warn(`[env] failed to load ${filePath}: ${err.message}`)
  }
}

const repoRoot = resolve(process.cwd())
loadEnv(resolve(repoRoot, 'apps/admin/.env.vercel.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[error] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const PLATFORM_FILTER = process.argv.find((a) => a.startsWith('--platform='))?.split('=')[1]
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow'
const BATCH_SIZE = 10000

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase ${options.method || 'GET'} ${path} → ${res.status}: ${body}`)
  }
  return res.json()
}

// ── IndexNow ──────────────────────────────────────────────────────────────────

async function pingIndexNow(host, key, keyLocation, urls) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would ping IndexNow: ${urls.length} URLs for ${host}`)
    return
  }

  const batches = []
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE))
  }

  for (const [i, batch] of batches.entries()) {
    const body = { host, key, keyLocation, urlList: batch }
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (res.ok || res.status === 202) {
      console.log(`  ✓ Batch ${i + 1}/${batches.length}: ${batch.length} URLs → ${res.status}`)
    } else {
      console.warn(`  ⚠ Batch ${i + 1}/${batches.length}: ${res.status} — ${text.slice(0, 200)}`)
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`IndexNow initial seed${DRY_RUN ? ' [DRY RUN]' : ''}`)
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log()

  // 1. Fetch all public regional platforms with indexnow_key
  let platformQuery = '/platforms?select=id,regio_platform,domain,preview_domain,indexnow_key&is_public=eq.true&tier=eq.free&indexnow_key=not.is.null'
  if (PLATFORM_FILTER) {
    platformQuery += `&id=eq.${PLATFORM_FILTER}`
  }

  const platforms = await supabaseFetch(platformQuery)
  console.log(`Found ${platforms.length} platforms with IndexNow key`)

  let totalUrls = 0
  let totalPlatforms = 0

  for (const platform of platforms) {
    const host = platform.preview_domain ?? platform.domain
    if (!host) {
      console.log(`  [skip] ${platform.regio_platform} — no domain/preview_domain`)
      continue
    }
    if (!platform.indexnow_key) {
      console.log(`  [skip] ${platform.regio_platform} — no indexnow_key`)
      continue
    }

    console.log(`\n── ${platform.regio_platform} (${host}) ──`)

    // 2. Fetch all approved+published jobs via junction table
    const rows = await supabaseFetch(
      `/job_posting_platforms?select=job_postings(slug,published_at,review_status)&platform_id=eq.${platform.id}&is_primary=eq.true&job_postings.review_status=eq.approved&job_postings.published_at=not.is.null&limit=50000`
    )

    // Extract slugs
    const slugs = []
    for (const row of rows) {
      const jp = Array.isArray(row.job_postings) ? row.job_postings[0] : row.job_postings
      if (!jp?.slug) continue
      slugs.push(jp.slug)
    }

    if (slugs.length === 0) {
      console.log(`  [skip] 0 approved jobs`)
      continue
    }

    // Build URL list: homepage + /vacatures + /vacature/{slug}
    const urls = [
      `https://${host}/`,
      `https://${host}/vacatures`,
      ...slugs.map((s) => `https://${host}/vacature/${s}`),
    ]

    const keyLocation = `https://${host}/${platform.indexnow_key}.txt`

    console.log(`  ${urls.length} URLs (${slugs.length} jobs + 2 static)`)
    console.log(`  Key location: ${keyLocation}`)

    await pingIndexNow(host, platform.indexnow_key, keyLocation, urls)
    totalUrls += urls.length
    totalPlatforms += 1
  }

  console.log(`\n✓ Done: ${totalUrls} URLs across ${totalPlatforms} platforms`)
}

main().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
