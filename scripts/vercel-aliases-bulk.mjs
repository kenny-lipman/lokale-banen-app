/**
 * Vercel Aliases Bulk Setup
 * Creates `<preview_domain>` aliases on the public-sites project for each platform.
 * Run: node scripts/vercel-aliases-bulk.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { execSync } from 'child_process'

// Load .env.local from repo root
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split('=').map((s) => s.trim()))
    .filter(([k, v]) => k && v)
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const PROD_DEPLOYMENT =
  process.env.PROD_DEPLOYMENT_URL ??
  'https://lokale-banen-public-p4tzwdalg-bespoke-automation.vercel.app'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars in .env.local')
  process.exit(1)
}

async function fetchPlatforms() {
  const url = `${SUPABASE_URL}/rest/v1/platforms?select=regio_platform,preview_domain,domain&preview_domain=not.is.null&is_public=eq.true&order=regio_platform.asc`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!res.ok) {
    console.error(`Supabase fetch error: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  return res.json()
}

const platforms = await fetchPlatforms()
console.log(`Found ${platforms.length} platforms with preview_domain`)
console.log(`Target deployment: ${PROD_DEPLOYMENT}\n`)

const results = { ok: [], failed: [], alreadySet: [] }

for (const p of platforms) {
  const alias = p.preview_domain
  process.stdout.write(`${p.regio_platform.padEnd(24)} → ${alias.padEnd(42)} `)
  try {
    const out = execSync(`vercel alias set ${PROD_DEPLOYMENT} ${alias} 2>&1`, {
      encoding: 'utf8',
    })
    if (out.includes('now points to') || out.includes('Success')) {
      console.log('OK')
      results.ok.push({ platform: p.regio_platform, alias })
    } else {
      console.log('UNKNOWN')
      results.failed.push({ platform: p.regio_platform, alias, out: out.slice(0, 300) })
    }
  } catch (err) {
    const msg = (err.stderr?.toString() ?? err.message).trim()
    const firstLine = msg.split('\n').find((l) => l.includes('Error') || l.includes('already')) ?? msg.split('\n')[0]
    if (msg.includes('already') || msg.includes('exists')) {
      console.log('ALREADY SET')
      results.alreadySet.push({ platform: p.regio_platform, alias })
    } else {
      console.log(`FAILED: ${firstLine.slice(0, 80)}`)
      results.failed.push({
        platform: p.regio_platform,
        alias,
        error: msg.slice(0, 500),
      })
    }
  }
}

console.log(`\n---`)
console.log(`OK:          ${results.ok.length}`)
console.log(`ALREADY SET: ${results.alreadySet.length}`)
console.log(`FAILED:      ${results.failed.length}`)

if (results.failed.length > 0) {
  console.log('\nFailed aliases:')
  for (const f of results.failed) {
    const firstErrorLine = (f.error ?? f.out ?? '').split('\n').slice(0, 2).join(' | ').slice(0, 200)
    console.log(`  ${f.platform} (${f.alias}): ${firstErrorLine}`)
  }
}

const outputPath = resolve(process.cwd(), '.planning', 'vercel-aliases.json')
mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, JSON.stringify(results, null, 2))
console.log(`\nResults saved to ${outputPath}`)
