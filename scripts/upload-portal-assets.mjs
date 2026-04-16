/**
 * Fase 0 — Upload portal logo assets to Supabase Storage
 *
 * Voor elk ZIP-folder met een matched DB-platform:
 *   - logo.svg  → platform-assets/{platform_id}/logo.svg         → platforms.logo_url
 *   - icon.svg  → platform-assets/{platform_id}/icon.svg         → platforms.favicon_url
 *   - box.svg   → platform-assets/{platform_id}/box.svg          → (later: og_image basis)
 *
 * Run: node scripts/upload-portal-assets.mjs
 *      node scripts/upload-portal-assets.mjs --dry-run
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, basename, join } from 'path'

// ── Env ─────────────────────────────────────────────────────────────
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
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const DRY = process.argv.includes('--dry-run')
const STAGING = resolve(process.cwd(), '.branding-staging')
const MAPPING = JSON.parse(readFileSync(join(STAGING, 'portal-mapping.json'), 'utf8'))
const BUCKET = 'platform-assets'

// ── Helpers ─────────────────────────────────────────────────────────
function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

async function uploadFile(path, content, contentType) {
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
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload fail ${path}: ${res.status} ${text}`)
  }
  return publicUrl(path)
}

async function patchPlatform(id, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/platforms?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Patch fail ${id}: ${res.status} ${text}`)
  }
}

// Find SVG files in a ZIP-folder by role
function findSvgsIn(portalDir) {
  if (!existsSync(portalDir)) return { logo: null, icon: null, box: null }
  const files = readdirSync(portalDir)
  const svgs = files.filter(f => f.toLowerCase().endsWith('.svg'))

  // Skip any *_txt.svg (alternate text-version of logo)
  const exclude = (f) => /_txt\.svg$/i.test(f)

  const logo = svgs.find(f => !exclude(f) && (/^logo_/i.test(f) || /_Logo\.svg$/.test(f)))
  const icon = svgs.find(f => /^icon_/i.test(f) || /_Icon\.svg$/.test(f))
  const box  = svgs.find(f => /_box\.svg$/i.test(f) || /_Box\.svg$/.test(f))

  return {
    logo: logo ? join(portalDir, logo) : null,
    icon: icon ? join(portalDir, icon) : null,
    box:  box  ? join(portalDir, box)  : null,
  }
}

function findPortalDir(zipFolder) {
  const z1 = join(STAGING, 'zip1', zipFolder)
  const z2 = join(STAGING, 'zip2', zipFolder)
  if (existsSync(z2)) return z2 // zip2 is newer/preferred for overlaps
  if (existsSync(z1)) return z1
  return null
}

// ── Main ────────────────────────────────────────────────────────────
const matched = MAPPING.mapping.filter(m => m.db_match)
console.log(`${DRY ? 'DRY-RUN' : 'UPLOAD'}: ${matched.length} matched platforms`)
console.log('')

let ok = 0, skipped = 0, failed = 0
const results = []

for (const entry of matched) {
  const platformId = entry.db_match.id
  const portalName = entry.db_match.regio_platform
  const portalDir = findPortalDir(entry.zip_folder)
  if (!portalDir) {
    console.log(`  ⚠ ${portalName.padEnd(28)} — no ZIP folder (${entry.zip_folder})`)
    skipped++
    continue
  }
  const svgs = findSvgsIn(portalDir)
  if (!svgs.logo) {
    console.log(`  ⚠ ${portalName.padEnd(28)} — no logo.svg`)
    skipped++
    continue
  }

  const updates = {}
  const uploaded = []
  try {
    // Logo (main)
    const logoContent = readFileSync(svgs.logo)
    const logoPath = `${platformId}/logo.svg`
    if (!DRY) await uploadFile(logoPath, logoContent, 'image/svg+xml')
    updates.logo_url = publicUrl(logoPath)
    uploaded.push('logo')

    // Icon (favicon base)
    if (svgs.icon) {
      const iconContent = readFileSync(svgs.icon)
      const iconPath = `${platformId}/icon.svg`
      if (!DRY) await uploadFile(iconPath, iconContent, 'image/svg+xml')
      updates.favicon_url = publicUrl(iconPath)
      uploaded.push('icon')
    }

    // Box (for OG image later)
    if (svgs.box) {
      const boxContent = readFileSync(svgs.box)
      const boxPath = `${platformId}/box.svg`
      if (!DRY) await uploadFile(boxPath, boxContent, 'image/svg+xml')
      uploaded.push('box')
    }

    // Update platforms row
    if (!DRY && Object.keys(updates).length) {
      await patchPlatform(platformId, updates)
    }

    console.log(`  ✓ ${portalName.padEnd(28)} [${uploaded.join(', ')}]`)
    ok++
    results.push({ platform: portalName, id: platformId, uploaded, logo_url: updates.logo_url, favicon_url: updates.favicon_url })
  } catch (err) {
    console.log(`  ✗ ${portalName.padEnd(28)} ${err.message}`)
    failed++
  }
}

console.log('')
console.log(`Summary: ${ok} ok, ${skipped} skipped, ${failed} failed`)
if (DRY) console.log('(dry run — no writes)')
