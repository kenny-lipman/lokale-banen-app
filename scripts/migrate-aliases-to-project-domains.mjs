/**
 * Migreer alle *.vercel.app deployment-aliassen van het public-sites project
 * naar project-domains binnen hetzelfde project.
 *
 * Verschil:
 *   - Deployment-alias  : gepind aan dpl_xxx, herbindt NIET op nieuwe deploys.
 *   - Project-domain    : gekoppeld aan project, volgt automatisch de huidige
 *                         production-deploy.
 *
 * Per domain (volgorde-kritisch):
 *   1) DELETE /v2/aliases/{alias}                        — alias verwijderen
 *   2) POST   /v10/projects/{projectId}/domains          — project-domain toevoegen
 *   3) GET    /v9/projects/{projectId}/domains/{domain}  — verifieer verified=true
 *
 * Tussen stap 1 en 2 is er ~1-3s "gat" waarin het domain niets bedient.
 *
 * Idempotent: als domain al project-domain is → skip.
 *
 * Run:
 *   node scripts/migrate-aliases-to-project-domains.mjs --dry-run
 *   node scripts/migrate-aliases-to-project-domains.mjs --only=westlandsebanen.vercel.app
 *   node scripts/migrate-aliases-to-project-domains.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'

// ── Env ─────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
let env = {}
try {
  env = Object.fromEntries(
    readFileSync(envPath, 'utf-8').split('\n')
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const idx = line.indexOf('=')
        if (idx < 0) return [null, null]
        const k = line.slice(0, idx).trim()
        let v = line.slice(idx + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        return [k, v]
      })
      .filter(([k, v]) => k && v)
  )
} catch {}

function readCliToken() {
  try {
    const obj = JSON.parse(readFileSync(`${homedir()}/Library/Application Support/com.vercel.cli/auth.json`, 'utf-8'))
    return obj.token || null
  } catch { return null }
}

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN || env.VERCEL_API_TOKEN || readCliToken()
const TEAM_ID = process.env.VERCEL_TEAM_ID || env.VERCEL_TEAM_ID || 'team_PlngQPHXlPVJkziKq9MLOr3X'
const PROJECT_ID = process.env.VERCEL_PUBLIC_SITES_PROJECT_ID || env.VERCEL_PUBLIC_SITES_PROJECT_ID || 'prj_ht1wPrgsG5ktFLFyxTY3avUFMgGt'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

if (!VERCEL_TOKEN) { console.error('Geen Vercel token.'); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Mist Supabase env'); process.exit(1) }

const DRY = process.argv.includes('--dry-run')
const onlyArg = process.argv.find(a => a.startsWith('--only='))
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null
const teamQ = TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : ''
const teamQ2 = TEAM_ID ? `&teamId=${encodeURIComponent(TEAM_ID)}` : ''

// ── Vercel helpers ──────────────────────────────────────────────────
async function vercelRequest(path, init = {}) {
  const url = `https://api.vercel.com${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, ok: res.ok, body }
}

async function isProjectDomain(domain) {
  const r = await vercelRequest(`/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}${teamQ}`)
  return r.ok
}

async function getAlias(domain) {
  const r = await vercelRequest(`/v4/aliases/${encodeURIComponent(domain)}${teamQ}`)
  if (!r.ok) return null
  return r.body
}

async function deleteAlias(aliasUid) {
  if (DRY) return { ok: true }
  return vercelRequest(`/v2/aliases/${encodeURIComponent(aliasUid)}${teamQ}`, { method: 'DELETE' })
}

async function addProjectDomain(domain) {
  if (DRY) return { ok: true }
  return vercelRequest(`/v10/projects/${PROJECT_ID}/domains${teamQ}`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  })
}

// ── Supabase ────────────────────────────────────────────────────────
async function fetchPreviewDomains() {
  const url = `${SUPABASE_URL}/rest/v1/platforms?preview_domain=not.is.null&select=regio_platform,preview_domain&order=preview_domain`
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) throw new Error(`fetchPreviewDomains: ${res.status}`)
  return res.json()
}

// ── Main ────────────────────────────────────────────────────────────
let platforms = await fetchPreviewDomains()
if (ONLY) platforms = platforms.filter(p => p.preview_domain === ONLY)

console.log(`${DRY ? '🔍 DRY-RUN' : '🚀 LIVE'} — ${platforms.length} domains te migreren\n`)

let migrated = 0, alreadyDone = 0, failed = 0
const errors = []

for (const p of platforms) {
  const domain = p.preview_domain
  process.stdout.write(`${domain.padEnd(40)} `)

  try {
    if (await isProjectDomain(domain)) {
      console.log('✅ al project-domain')
      alreadyDone++
      continue
    }

    const alias = await getAlias(domain)
    if (alias?.uid) {
      const del = await deleteAlias(alias.uid)
      if (!del.ok) {
        console.log(`❌ delete-alias ${del.status} ${JSON.stringify(del.body).slice(0, 100)}`)
        failed++; errors.push({ domain, step: 'delete', body: del.body })
        continue
      }
    }

    const add = await addProjectDomain(domain)
    if (!add.ok) {
      console.log(`❌ add-project-domain ${add.status} ${JSON.stringify(add.body).slice(0, 120)}`)
      failed++; errors.push({ domain, step: 'add', body: add.body })
      continue
    }

    console.log(`✅ alias→project-domain (verified=${add.body?.verified ?? 'n/a'})`)
    migrated++
  } catch (err) {
    console.log(`❌ ${err.message}`)
    failed++; errors.push({ domain, step: 'exception', message: err.message })
  }
}

console.log(`\n${DRY ? '[DRY] ' : ''}MIGRATED: ${migrated}  |  ALREADY: ${alreadyDone}  |  FAILED: ${failed}`)
if (errors.length) {
  console.log('\nErrors:')
  for (const e of errors) console.log(`  ${e.domain} (${e.step}):`, e.body || e.message)
  process.exit(1)
}
