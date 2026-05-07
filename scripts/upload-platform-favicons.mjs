/**
 * Upload favicons (SVG + PNG) voor alle platforms.
 *
 * Bron: /tmp/favicons-svg en /tmp/favicons-png (uitgepakt uit zips door Kenny)
 * Mapping: /tmp/favicon-mapping.json (gegenereerd door /tmp/favicon-mapping.mjs)
 *
 * Per platform:
 *   - SVG → platform-assets/{platformId}/favicon.svg
 *   - PNG → platform-assets/{platformId}/favicon.png  (fallback voor non-SVG)
 *   - UPDATE platforms SET favicon_url = <public SVG URL>
 *
 * Skip: NijmeegseBanen, Vacature Westland, WestlandseStages (geen bron).
 * Idempotent via x-upsert: true. Overschrijft bestaande favicons.
 *
 * Run:
 *   node scripts/upload-platform-favicons.mjs --dry-run
 *   node scripts/upload-platform-favicons.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ── Env ─────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const DRY = process.argv.includes('--dry-run')
const BUCKET = 'platform-assets'
const SVG_DIR = '/tmp/favicons-svg'
const PNG_DIR = '/tmp/favicons-png'
const MAPPING_PATH = '/tmp/favicon-mapping.json'

// ── Helpers ─────────────────────────────────────────────────────────
const publicUrl = (p) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`

async function uploadFile(path, content, contentType) {
  if (DRY) return publicUrl(path)
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: content,
  })
  if (!res.ok) throw new Error(`Upload ${path}: ${res.status} ${await res.text()}`)
  return publicUrl(path)
}

async function patchFaviconUrl(id, faviconUrl) {
  if (DRY) return
  const res = await fetch(`${SUPABASE_URL}/rest/v1/platforms?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ favicon_url: faviconUrl }),
  })
  if (!res.ok) throw new Error(`Patch ${id}: ${res.status} ${await res.text()}`)
}

// ── Main ────────────────────────────────────────────────────────────
const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'))

// Dedupe op platform_id; directe match wint van alias-match.
const byPlatform = new Map()
for (const m of mapping.matched) {
  const existing = byPlatform.get(m.platform_id)
  if (!existing) { byPlatform.set(m.platform_id, m); continue }
  if (existing.via_alias && !m.via_alias) byPlatform.set(m.platform_id, m)
}

const tasks = [...byPlatform.values()].sort((a, b) => a.regio_platform.localeCompare(b.regio_platform))

console.log(`${DRY ? '🔍 DRY-RUN' : '🚀 LIVE'} — ${tasks.length} platforms te updaten\n`)

let ok = 0, fail = 0
const errors = []

for (const t of tasks) {
  const svgPath = join(SVG_DIR, t.svg)
  const pngPath = join(PNG_DIR, t.png)
  if (!existsSync(svgPath) || !existsSync(pngPath)) {
    console.log(`❌ ${t.regio_platform.padEnd(28)} — bron mist (svg=${existsSync(svgPath)}, png=${existsSync(pngPath)})`)
    fail++
    errors.push({ platform: t.regio_platform, error: 'source missing' })
    continue
  }

  try {
    const svgBytes = readFileSync(svgPath)
    const pngBytes = readFileSync(pngPath)

    const svgUrl = await uploadFile(`${t.platform_id}/favicon.svg`, svgBytes, 'image/svg+xml')
    await uploadFile(`${t.platform_id}/favicon.png`, pngBytes, 'image/png')
    await patchFaviconUrl(t.platform_id, svgUrl)

    console.log(`✅ ${t.regio_platform.padEnd(28)} — ${t.svg}${t.via_alias ? ' (alias)' : ''}`)
    ok++
  } catch (err) {
    console.log(`❌ ${t.regio_platform.padEnd(28)} — ${err.message}`)
    fail++
    errors.push({ platform: t.regio_platform, error: err.message })
  }
}

console.log(`\n${DRY ? '[DRY] ' : ''}OK: ${ok}  |  FAIL: ${fail}`)
if (errors.length) {
  console.log('\nErrors:')
  for (const e of errors) console.log(`  ${e.platform}: ${e.error}`)
  process.exit(1)
}
