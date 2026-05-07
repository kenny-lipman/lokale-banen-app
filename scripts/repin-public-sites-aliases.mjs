/**
 * Herpin alle preview_domain aliassen van het public-sites Vercel project naar de
 * meest recente READY production deployment.
 *
 * Achtergrond: tenant-specifieke vercel.app aliassen zijn historisch via
 * `POST /v2/deployments/{id}/aliases` aangemaakt en zijn daardoor "gepind" aan
 * een specifieke deployment. Een nieuwe push naar main herbindt ze niet
 * automatisch — dit script doet dat in bulk.
 *
 * Run:
 *   node scripts/repin-public-sites-aliases.mjs --dry-run
 *   node scripts/repin-public-sites-aliases.mjs
 *
 * Auth:
 *   - VERCEL_API_TOKEN env var, OF
 *   - Vercel CLI token uit ~/Library/Application Support/com.vercel.cli/auth.json (macOS)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'

// ── Env ─────────────────────────────────────────────────────────────
// In GH Actions / CI staat .env.local er niet — vallen we terug op process.env.
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
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        return [k, v]
      })
      .filter(([k, v]) => k && v)
  )
} catch {
  // .env.local niet gevonden — gebruik alleen process.env (CI-modus)
}

function readCliToken() {
  const path = `${homedir()}/Library/Application Support/com.vercel.cli/auth.json`
  try {
    const obj = JSON.parse(readFileSync(path, 'utf-8'))
    return obj.token || null
  } catch { return null }
}

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN || env.VERCEL_API_TOKEN || readCliToken()
const TEAM_ID = process.env.VERCEL_TEAM_ID || env.VERCEL_TEAM_ID || 'team_PlngQPHXlPVJkziKq9MLOr3X'
const PROJECT_ID = process.env.VERCEL_PUBLIC_SITES_PROJECT_ID || env.VERCEL_PUBLIC_SITES_PROJECT_ID || 'prj_ht1wPrgsG5ktFLFyxTY3avUFMgGt'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

if (!VERCEL_TOKEN) {
  console.error('Geen Vercel token. Zet VERCEL_API_TOKEN of log in via Vercel CLI.')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const DRY = process.argv.includes('--dry-run')
const teamQ = TEAM_ID ? `&teamId=${encodeURIComponent(TEAM_ID)}` : ''
const teamQ2 = TEAM_ID ? `?teamId=${encodeURIComponent(TEAM_ID)}` : ''

// ── Vercel ──────────────────────────────────────────────────────────
async function getLatestProdDeployment() {
  const url = `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&target=production&state=READY&limit=1${teamQ}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } })
  if (!res.ok) throw new Error(`getLatestProdDeployment: ${res.status} ${await res.text()}`)
  const json = await res.json()
  return json.deployments?.[0] || null
}

async function setAlias(deploymentId, alias) {
  if (DRY) return { ok: true, oldDeploymentId: '(dry)' }
  const url = `https://api.vercel.com/v2/deployments/${encodeURIComponent(deploymentId)}/aliases${teamQ2}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ alias }),
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, error: `${res.status} ${text}` }
  let parsed = {}
  try { parsed = JSON.parse(text) } catch {}
  return { ok: true, oldDeploymentId: parsed.oldDeploymentId || null, uid: parsed.uid }
}

// ── Supabase ────────────────────────────────────────────────────────
async function fetchPreviewDomains() {
  const url = `${SUPABASE_URL}/rest/v1/platforms?preview_domain=not.is.null&select=regio_platform,preview_domain&order=preview_domain`
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) throw new Error(`fetchPreviewDomains: ${res.status}`)
  return res.json()
}

// ── Main ────────────────────────────────────────────────────────────
const deploy = await getLatestProdDeployment()
if (!deploy) { console.error('Geen READY production deployment gevonden.'); process.exit(1) }
console.log(`Latest production deploy: ${deploy.uid}  (url=${deploy.url})\n`)

const platforms = await fetchPreviewDomains()
console.log(`${DRY ? '🔍 DRY-RUN' : '🚀 LIVE'} — ${platforms.length} aliassen te herpinnen\n`)

let ok = 0, skip = 0, fail = 0
for (const p of platforms) {
  const result = await setAlias(deploy.uid, p.preview_domain)
  if (!result.ok) {
    console.log(`❌ ${p.preview_domain.padEnd(38)} — ${result.error}`)
    fail++
    continue
  }
  if (result.oldDeploymentId === deploy.uid) {
    console.log(`⏩ ${p.preview_domain.padEnd(38)} — al gepind aan latest`)
    skip++
  } else {
    console.log(`✅ ${p.preview_domain.padEnd(38)} — ${result.oldDeploymentId || 'new'} → ${deploy.uid}`)
    ok++
  }
}

console.log(`\n${DRY ? '[DRY] ' : ''}OK: ${ok}  |  SKIP: ${skip}  |  FAIL: ${fail}`)
if (fail > 0) process.exit(1)
