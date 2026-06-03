/**
 * Koppel echte .nl-domeinen (kolom platforms.domain) aan het public-sites
 * Vercel-project en zet de bijbehorende DNS bij TransIP.
 *
 * Per domein (apex = canonical, www = 308-redirect naar apex):
 *   1) TransIP : controleer dat het domein in het account zit + DNS bewerkbaar is
 *   2) Vercel  : voeg apex als project-domain toe + www als redirect naar apex
 *   3) TransIP : upsert  @  A     -> 76.76.21.21
 *                upsert  www CNAME -> cname.vercel-dns.com
 *                (+ eventuele _vercel TXT-verificatie die Vercel teruggeeft)
 *   4) Vercel  : poll tot verified=true (SSL wordt daarna automatisch geregeld)
 *
 * Bestaande records (o.a. MX/mail) blijven intact: we vervangen alleen de
 * specifieke @/www-records, nooit de volledige zone.
 *
 * Idempotent. Veilig opnieuw te draaien.
 *
 * Env (.env.local of process.env):
 *   TRANSIP_LOGIN, TRANSIP_PRIVATE_KEY(_FILE)
 *   VERCEL_API_TOKEN            (anders valt hij terug op de Vercel-CLI login)
 *   VERCEL_TEAM_ID, VERCEL_PUBLIC_SITES_PROJECT_ID  (defaults hieronder)
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node scripts/setup-custom-domains.mjs --dry-run
 *   node scripts/setup-custom-domains.mjs --only=achterhoeksebanen.nl
 *   node scripts/setup-custom-domains.mjs --limit=5
 *   node scripts/setup-custom-domains.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import { getAccessToken, createTransipClient, normalizeContent } from './lib/transip-client.mjs'

// ── Env laden ───────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
let fileEnv = {}
try {
  fileEnv = Object.fromEntries(
    readFileSync(envPath, 'utf-8').split('\n')
      .filter(l => l && !l.startsWith('#'))
      .map(l => {
        const i = l.indexOf('=')
        if (i < 0) return [null, null]
        const k = l.slice(0, i).trim()
        let v = l.slice(i + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        return [k, v]
      })
      .filter(([k, v]) => k && v)
  )
} catch {}
const E = (k, d) => process.env[k] ?? fileEnv[k] ?? d
// .env.local-waarden ook in process.env zetten zodat de transip-client ze ziet.
for (const [k, v] of Object.entries(fileEnv)) if (process.env[k] === undefined) process.env[k] = v

function readVercelCliToken() {
  try {
    const obj = JSON.parse(readFileSync(`${homedir()}/Library/Application Support/com.vercel.cli/auth.json`, 'utf-8'))
    return obj.token || null
  } catch { return null }
}

const VERCEL_TOKEN = E('VERCEL_API_TOKEN') || readVercelCliToken()
const TEAM_ID = E('VERCEL_TEAM_ID', 'team_PlngQPHXlPVJkziKq9MLOr3X')
const PROJECT_ID = E('VERCEL_PUBLIC_SITES_PROJECT_ID', 'prj_ht1wPrgsG5ktFLFyxTY3avUFMgGt')
const SUPABASE_URL = E('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = E('SUPABASE_SERVICE_ROLE_KEY')
const APEX_A_RECORD = E('VERCEL_A_RECORD', '76.76.21.21')
const WWW_CNAME = E('VERCEL_CNAME', 'cname.vercel-dns.com')
const DNS_TTL = Number(E('TRANSIP_DNS_TTL', '300'))

const DRY = process.argv.includes('--dry-run')
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice('--only='.length) || null
const LIMIT = Number((process.argv.find(a => a.startsWith('--limit=')) || '').slice('--limit='.length) || '0')

if (!VERCEL_TOKEN) { console.error('Geen Vercel token (VERCEL_API_TOKEN of CLI-login).'); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Mist Supabase env.'); process.exit(1) }

// ── Vercel helpers ──────────────────────────────────────────────────
async function vercel(path, init = {}) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://api.vercel.com${path}${TEAM_ID ? `${sep}teamId=${encodeURIComponent(TEAM_ID)}` : ''}`
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const text = await res.text()
  let body; try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: res.status, ok: res.ok, body }
}

async function getProjectDomain(domain) {
  const r = await vercel(`/v9/projects/${PROJECT_ID}/domains/${encodeURIComponent(domain)}`)
  return r.ok ? r.body : null
}

async function addProjectDomain(name, extra = {}) {
  if (DRY) return { ok: true, body: { name, ...extra, dryRun: true } }
  return vercel(`/v10/projects/${PROJECT_ID}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name, ...extra }),
  })
}

// ── Supabase ────────────────────────────────────────────────────────
async function fetchTargets() {
  const url = `${SUPABASE_URL}/rest/v1/platforms?domain=not.is.null&select=regio_platform,domain,preview_domain,is_public&order=domain`
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) throw new Error(`fetchTargets ${res.status}: ${await res.text()}`)
  return res.json()
}

// ── TransIP DNS upsert ──────────────────────────────────────────────
function entryMatches(e, name, type) {
  return e.name === name && e.type === type
}

/**
 * Zorg dat er precies één {name,type}-record met `content` bestaat.
 * Verwijdert afwijkende records met dezelfde naam+type, voegt toe indien nodig.
 * Returnt 'ok' | 'added' | 'replaced'.
 */
async function upsertDns(tp, domain, current, { name, type, content, expire = DNS_TTL }) {
  const same = current.filter(e => entryMatches(e, name, type))
  const exact = same.find(e => normalizeContent(e.content) === normalizeContent(content))

  if (exact && same.length === 1) return 'ok'

  // Verwijder alle afwijkende records met deze naam+type.
  for (const e of same) {
    if (normalizeContent(e.content) === normalizeContent(content)) continue
    if (!DRY) {
      const del = await tp.deleteDnsEntry(domain, e)
      if (!del.ok) throw new Error(`delete ${name}/${type} ${del.status}: ${JSON.stringify(del.body)}`)
    }
  }

  if (!exact) {
    if (!DRY) {
      const add = await tp.addDnsEntry(domain, { name, type, content, expire })
      if (!add.ok) throw new Error(`add ${name}/${type} ${add.status}: ${JSON.stringify(add.body)}`)
    }
    return same.length ? 'replaced' : 'added'
  }
  return 'replaced'
}

// ── Main ────────────────────────────────────────────────────────────
console.log(`${DRY ? '🔍 DRY-RUN' : '🚀 LIVE'} - custom domains setup (TransIP + Vercel)\n`)

let targets = await fetchTargets()
if (ONLY) targets = targets.filter(t => t.domain === ONLY || t.regio_platform === ONLY)
if (LIMIT > 0) targets = targets.slice(0, LIMIT)
console.log(`${targets.length} domein(en) te verwerken.\n`)

// TransIP-token + account-domeinen ophalen.
let tp, accountDomains
try {
  const token = await getAccessToken({ label: 'lokale-banen-custom-domains' })
  tp = createTransipClient(token)
  accountDomains = new Map((await tp.listDomains()).map(d => [d.name.toLowerCase(), d]))
  console.log(`TransIP: ${accountDomains.size} domeinen in account.\n`)
} catch (err) {
  console.error(`TransIP auth/list mislukt: ${err.message}`)
  process.exit(1)
}

const summary = { done: 0, pending: 0, skipped: 0, failed: 0 }
const issues = []

for (const t of targets) {
  const apex = t.domain.toLowerCase().replace(/^www\./, '')
  const www = `www.${apex}`
  process.stdout.write(`\n=== ${t.regio_platform} (${apex}) ===\n`)

  try {
    // 1. Domein in TransIP-account?
    const acct = accountDomains.get(apex)
    if (!acct) {
      console.log(`  ⚠️  niet in TransIP-account - overgeslagen`)
      summary.skipped++; issues.push({ domain: apex, issue: 'niet in TransIP-account' })
      continue
    }
    if (acct.canEditDns === false) {
      console.log(`  ⚠️  DNS niet bewerkbaar (canEditDns=false) - overgeslagen`)
      summary.skipped++; issues.push({ domain: apex, issue: 'canEditDns=false' })
      continue
    }

    // 2. Vercel project-domains (apex + www-redirect).
    for (const [name, extra] of [[apex, {}], [www, { redirect: apex, redirectStatusCode: 308 }]]) {
      const existing = await getProjectDomain(name)
      if (existing) { console.log(`  vercel: ${name} bestaat al`); continue }
      const add = await addProjectDomain(name, extra)
      if (!add.ok) throw new Error(`vercel add ${name} ${add.status}: ${JSON.stringify(add.body)}`)
      console.log(`  vercel: ${name} toegevoegd${extra.redirect ? ' (308 → apex)' : ''}`)
    }

    // 3. DNS upserten bij TransIP.
    const current = await tp.getDnsEntries(apex)
    const wanted = [
      { name: '@', type: 'A', content: APEX_A_RECORD },
      { name: 'www', type: 'CNAME', content: WWW_CNAME },
    ]
    // Verificatie-TXT die Vercel vraagt (komt voor als domein elders geclaimd is).
    const apexInfo = await getProjectDomain(apex)
    for (const v of apexInfo?.verification || []) {
      if (v.type === 'TXT') {
        const recName = v.domain?.replace(`.${apex}`, '').replace(apex, '@') || '_vercel'
        wanted.push({ name: recName, type: 'TXT', content: v.value })
      }
    }
    for (const w of wanted) {
      const r = await upsertDns(tp, apex, current, w)
      console.log(`  dns: ${w.name} ${w.type} -> ${w.content}  [${r}]`)
    }

    // 4. Verificatiestatus.
    const after = await getProjectDomain(apex)
    if (after?.verified) { console.log(`  ✅ verified`); summary.done++ }
    else {
      console.log(`  ⏳ nog niet verified - DNS-propagatie kan tot ~30 min duren`)
      summary.pending++
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`)
    summary.failed++; issues.push({ domain: apex, issue: err.message })
  }
}

console.log(`\n────────────────────────────`)
console.log(`✅ verified: ${summary.done}  |  ⏳ pending: ${summary.pending}  |  ⏭️  skipped: ${summary.skipped}  |  ❌ failed: ${summary.failed}`)
if (issues.length) {
  console.log(`\nAandachtspunten:`)
  for (const i of issues) console.log(`  ${i.domain}: ${i.issue}`)
}
if (summary.failed) process.exit(1)
