/**
 * Fase 0 — Upload logos + colors for the 15 newly-created platforms.
 * One-off follow-up on subagent output.
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8').split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=').map(s => s.trim()))
    .filter(([k, v]) => k && v)
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

const STAGING = resolve(process.cwd(), '.branding-staging')
const INVENTORY = JSON.parse(readFileSync(join(STAGING, 'branding-inventory.json'), 'utf8'))
const BUCKET = 'platform-assets'

// ZIP-folder → new platform UUID (from subagent output)
const NEW_PLATFORMS = {
  'BARseBanen':          'd37a8ef6-e40b-4fca-bda3-fa2c83621fea',
  'BrabantseBanen':      '4b81f214-c5ff-431b-b187-659c8fe1f377',
  'DrentseBanen':        'a621d5d7-2a66-4d6a-8af9-8ab10edbbf41',
  'FlevolandseBanen':    '2f288c74-4ec3-450f-af88-b77d86fd18ab',
  'FriesseBanen':        'd296696e-4dd3-434d-b9ed-4772c8bdc9f4',
  'HortiBanen':          '0044e6fb-f331-46df-86ff-bc18f81c6ddb',
  'LimburgseBanen':      '1f693f2e-a6ae-4f6f-a36e-f948966e6019',
  'RoermondseBanen':     'f5ac1798-0c8d-4cbd-9898-69e83893f5b4',
  'Vacature Westland':   '69fcf610-7ba5-4159-8345-049cab6f3d0b',
  'WaalwijkseBanen':     'fbf3e00b-98bc-4946-b698-3a88696c132f',
  'WaterwegseBanen':     'fbdcbe65-d00a-4a21-bcfe-e0fabb5b1b1e',
  'WerkenInAalsmeer':    '6a22baae-17fa-4234-8430-9fece84bb982',
  'WestlandseStages':    '347d2c69-0c61-40cf-b556-aa05f8428f95',
  'ZeelandseBanen':      'e9d63353-b17d-41ae-b21c-02d0db21ef6c',
  'ZuidhollandseBanen':  'a4eeaa00-94ae-4933-bff1-12685e2625fb',
}

const publicUrl = (p) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`

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
  if (!res.ok) throw new Error(`Upload ${path}: ${res.status} ${await res.text()}`)
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
  if (!res.ok) throw new Error(`Patch ${id}: ${res.status} ${await res.text()}`)
}

function findSvgs(portalDir) {
  if (!existsSync(portalDir)) return {}
  const files = readdirSync(portalDir)
  const svgs = files.filter(f => /\.svg$/i.test(f))
  const exclude = (f) => /_txt\.svg$/i.test(f)
  return {
    logo: svgs.find(f => !exclude(f) && (/^logo_/i.test(f) || /_Logo\.svg$/.test(f))),
    icon: svgs.find(f => /^icon_/i.test(f) || /_Icon\.svg$/.test(f)),
    box:  svgs.find(f => /_box\.svg$/i.test(f) || /_Box\.svg$/.test(f)),
  }
}

function findInventoryEntry(zipFolder) {
  const all = [...INVENTORY.zip1, ...INVENTORY.zip2]
  return all.find(e => e.portal === zipFolder)
}

console.log(`Uploading for ${Object.keys(NEW_PLATFORMS).length} new platforms`)
console.log('')

let ok = 0, failed = 0
for (const [zipFolder, platformId] of Object.entries(NEW_PLATFORMS)) {
  // Find portal directory
  const z1 = join(STAGING, 'zip1', zipFolder)
  const z2 = join(STAGING, 'zip2', zipFolder)
  const dir = existsSync(z2) ? z2 : existsSync(z1) ? z1 : null
  if (!dir) {
    console.log(`  ⚠ ${zipFolder.padEnd(22)} — no ZIP dir`)
    failed++
    continue
  }
  const svgs = findSvgs(dir)
  if (!svgs.logo) {
    console.log(`  ⚠ ${zipFolder.padEnd(22)} — no logo svg`)
    failed++
    continue
  }

  // Pull colors from inventory
  const entry = findInventoryEntry(zipFolder)
  const brand = entry?.colors_from_svg?.brand || []
  const primary = brand[0]?.hex || null
  const secondary = brand[1]?.hex || null
  const tertiary = brand[2]?.hex || null

  const updates = {}
  const uploaded = []
  try {
    const logoContent = readFileSync(join(dir, svgs.logo))
    const logoPath = `${platformId}/logo.svg`
    await uploadFile(logoPath, logoContent, 'image/svg+xml')
    updates.logo_url = publicUrl(logoPath)
    uploaded.push('logo')

    if (svgs.icon) {
      const iconContent = readFileSync(join(dir, svgs.icon))
      const iconPath = `${platformId}/icon.svg`
      await uploadFile(iconPath, iconContent, 'image/svg+xml')
      updates.favicon_url = publicUrl(iconPath)
      uploaded.push('icon')
    }
    if (svgs.box) {
      const boxContent = readFileSync(join(dir, svgs.box))
      const boxPath = `${platformId}/box.svg`
      await uploadFile(boxPath, boxContent, 'image/svg+xml')
      uploaded.push('box')
    }

    if (primary) updates.primary_color = primary
    if (secondary) updates.secondary_color = secondary
    if (tertiary) updates.tertiary_color = tertiary

    await patchPlatform(platformId, updates)
    const colorInfo = primary ? `[${primary}${secondary ? `+${secondary}` : ''}${tertiary ? `+${tertiary}` : ''}]` : '[no color]'
    console.log(`  ✓ ${zipFolder.padEnd(22)} ${uploaded.join(',').padEnd(14)} ${colorInfo}`)
    ok++
  } catch (err) {
    console.log(`  ✗ ${zipFolder.padEnd(22)} ${err.message}`)
    failed++
  }
}

console.log('')
console.log(`Summary: ${ok} ok, ${failed} failed`)
