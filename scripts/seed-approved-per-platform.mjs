/**
 * Seed 25 approved vacatures per public regional platform.
 *
 * Run: node scripts/seed-approved-per-platform.mjs [--dry-run] [--per-platform=25]
 *
 * Env vars loaded from apps/admin/.env.vercel.local (generate via `vercel env pull`):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVALIDATE_SECRET
 *   PUBLIC_SITES_URL
 *
 * Flow per platform:
 *   1. Fetch N newest pending jobs (scraped_at > now()-60d, platform_id matches).
 *   2. Skip if fewer than N available (log + continue).
 *   3. Per job: generate slug, UPDATE to approved, upsert job_posting_platforms.
 *   4. Batch revalidate public-sites cache (tags: platform:X, jobs:X, sitemap:X, job:slug).
 *   5. Batch IndexNow ping using preview_domain (productie .nl DNS not live yet).
 *
 * Skipped platforms (0 recent pending): HelmondseBanen, OsseBanen, RoosendaalseBanen.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// ---------- env loading ----------

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
loadEnv(resolve(repoRoot, '.env.local'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET
const PUBLIC_SITES_URL =
  process.env.PUBLIC_SITES_URL ?? 'https://lokale-banen-public.vercel.app'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!REVALIDATE_SECRET) {
  console.warn('[warn] REVALIDATE_SECRET not set — public-sites cache will NOT invalidate')
}

// ---------- CLI args ----------

const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')
const perPlatformArg = argv.find((a) => a.startsWith('--per-platform='))
const PER_PLATFORM = perPlatformArg ? Number(perPlatformArg.split('=')[1]) : 25

const SKIP_PLATFORMS = new Set(['HelmondseBanen', 'OsseBanen', 'RoosendaalseBanen'])

console.log(
  `[seed] start — per-platform=${PER_PLATFORM} dry-run=${DRY_RUN} skip=${[...SKIP_PLATFORMS].join(',')}`
)

// ---------- PostgREST helpers ----------

const pg = {
  async select(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    })
    if (!res.ok) {
      throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`)
    }
    return res.json()
  },
  async patch(path, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`PATCH ${path} -> ${res.status}: ${await res.text()}`)
    }
  },
  async upsert(path, body, onConflict) {
    const qs = onConflict ? `?on_conflict=${onConflict}` : ''
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${qs}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text()
      if (res.status === 409) {
        console.warn(`[upsert conflict] ${path}: ${txt}`)
        return
      }
      throw new Error(`UPSERT ${path} -> ${res.status}: ${txt}`)
    }
  },
}

// ---------- slug algo (mirrors apps/admin/app/api/review/bulk-approve/route.ts) ----------

function generateSlug(job) {
  const titlePart = (job.title || 'vacature').substring(0, 60).toLowerCase()
  const cityPart = (job.city || 'onbekend').toLowerCase()
  const idPart = job.id.replace(/-/g, '').substring(0, 8)
  const raw = `${titlePart}-${cityPart}-${idPart}`
  return raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ---------- IndexNow + revalidate ----------

async function revalidate({ platformId, jobSlugs }) {
  if (!REVALIDATE_SECRET) return { ok: false, skipped: true }
  try {
    const res = await fetch(`${PUBLIC_SITES_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': REVALIDATE_SECRET,
      },
      body: JSON.stringify({
        tags: [
          `platform:${platformId}`,
          `jobs:${platformId}`,
          `sitemap:${platformId}`,
          ...jobSlugs.map((s) => `job:${s}`),
        ],
        paths: [],
      }),
    })
    return { ok: res.ok, status: res.status }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

async function indexNow({ host, key, urlList }) {
  if (!host || !key || urlList.length === 0) {
    return { ok: false, error: 'missing params' }
  }
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList,
      }),
    })
    return { ok: res.ok || res.status === 202, status: res.status }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ---------- main ----------

async function main() {
  const platforms = await pg.select(
    `platforms?select=id,regio_platform,domain,preview_domain,indexnow_key` +
      `&is_public=eq.true&tier=neq.master&preview_domain=not.is.null&order=regio_platform.asc`
  )

  console.log(`[seed] ${platforms.length} public platforms`)

  const summary = []

  for (const platform of platforms) {
    const label = platform.regio_platform
    if (SKIP_PLATFORMS.has(label)) {
      console.log(`[${label}] skipped (0 recent pending, per prompt)`)
      summary.push({ platform: label, status: 'skipped', approved: 0 })
      continue
    }

    // 1. Fetch N newest pending jobs
    const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()
    const jobs = await pg.select(
      `job_postings?select=id,title,city` +
        `&platform_id=eq.${platform.id}` +
        `&review_status=in.(pending,still_pending)` +
        `&scraped_at=gt.${cutoff}` +
        `&order=scraped_at.desc` +
        `&limit=${PER_PLATFORM}`
    )

    if (jobs.length < PER_PLATFORM) {
      console.log(
        `[${label}] only ${jobs.length}/${PER_PLATFORM} recent pending — skipping`
      )
      summary.push({ platform: label, status: 'insufficient', approved: 0 })
      continue
    }

    console.log(`[${label}] approving ${jobs.length} jobs...`)

    const approvedSlugs = []
    const nowIso = new Date().toISOString()

    for (const job of jobs) {
      const slug = generateSlug(job)
      if (DRY_RUN) {
        approvedSlugs.push(slug)
        continue
      }
      try {
        await pg.patch(`job_postings?id=eq.${job.id}`, {
          review_status: 'approved',
          published_at: nowIso,
          reviewed_at: nowIso,
          reviewed_by: null,
          slug,
        })
        await pg
          .upsert(
            'job_posting_platforms',
            {
              job_posting_id: job.id,
              platform_id: platform.id,
              is_primary: true,
            },
            'job_posting_id,platform_id'
          )
          .catch(() => {
            // Ignore: no unique constraint or already exists
          })
        approvedSlugs.push(slug)
      } catch (err) {
        console.warn(`[${label}] failed job=${job.id}: ${err.message}`)
      }
    }

    // 2. Revalidate
    const revalResult = DRY_RUN
      ? { ok: true, skipped: true }
      : await revalidate({ platformId: platform.id, jobSlugs: approvedSlugs })

    // 3. IndexNow — use preview_domain (prod .nl DNS not yet live)
    const host = platform.preview_domain
    const urlList = [
      `https://${host}/vacatures`,
      `https://${host}/sitemap.xml`,
      ...approvedSlugs.map((s) => `https://${host}/vacature/${s}`),
    ]
    const indexResult = DRY_RUN
      ? { ok: true, skipped: true }
      : await indexNow({ host, key: platform.indexnow_key, urlList })

    console.log(
      `[${label}] ✓ approved=${approvedSlugs.length} reval=${revalResult.ok} indexnow=${indexResult.ok}${indexResult.status ? ` (${indexResult.status})` : ''}`
    )
    summary.push({
      platform: label,
      status: 'success',
      approved: approvedSlugs.length,
      reval: revalResult.ok,
      indexnow: indexResult.ok,
    })
  }

  console.log('\n[seed] done')
  console.table(summary)
  const totalApproved = summary.reduce((sum, s) => sum + (s.approved || 0), 0)
  console.log(`[seed] total approved: ${totalApproved}`)
}

main().catch((err) => {
  console.error('[seed] FATAL:', err)
  process.exit(1)
})
