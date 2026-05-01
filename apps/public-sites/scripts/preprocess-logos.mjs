#!/usr/bin/env node
/**
 * preprocess-logos.mjs
 *
 * Doel: alle ruwe portal-SVG's transformeren naar runtime-themed assets
 * waarin de hex-fills vervangen zijn door `var(--primary)` / `var(--secondary)`.
 * Output gaat naar `apps/public-sites/public/logos/<regio_platform>.svg`,
 * waarbij de bestandsnaam exact de DB-`regio_platform`-string is — zo kunnen
 * we runtime simpel `/logos/${tenant.name}.svg` linken zonder mapping-laag.
 *
 * Bron-SVG's: `.branding-staging/zip{1,2}/<ZipFolder>/logo_<slug>_2025.svg`.
 *
 * Strategie per SVG:
 *   1. Lees alle fills uit de <defs><style>-classes.
 *   2. Bepaal welke fill primary/secondary is:
 *      a) Eerst proberen via portals-config.json (closest-color match ≤30/channel)
 *      b) Anders via luminance-heuristiek (donkerste fill = primary)
 *   3. Vervang fills door var(--primary)/var(--secondary).
 *
 * Run: node apps/public-sites/scripts/preprocess-logos.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '../../..')
const ZIP_DIRS = [
  path.join(REPO_ROOT, '.branding-staging/zip1'),
  path.join(REPO_ROOT, '.branding-staging/zip2'),
]
const OUT_DIR = path.join(__dirname, '../public/logos')
const PORTALS_CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'portals-config.json'), 'utf-8')
)

// ZIP-folder-naam → { dbName, configSlug? }
//   - dbName = wat we runtime gebruiken als tenant.name (output-bestandsnaam)
//   - configSlug verwijst naar portals-config.json voor expliciete kleurmatch
//     (alleen invullen als zip-folder ≠ portals-config slug)
//
// Default (folder niet hier vermeld): dbName = folder, configSlug = folder.toLowerCase().
// Bron: .branding-staging/PORTAL-MAPPING.md (laatst gegenereerd 2026-04-15).
const ZIP_TO_DB = {
  'Drechtsebanen':              { dbName: 'DrechtseBanen' },
  'HardewijkseBanen':           { dbName: 'HarderwijkseBanen' },
  'MaassluiseBanen':            { dbName: 'MaasluisseBanen' },
  'NijmeegseBanen':             { dbName: 'NijmegenseBanen' },
  'OosterhoutseBanen (non JZ)': { dbName: 'OosterhoutseBanen' },
  'TilburgesBanen (non JZ)':    { dbName: 'TilburgseBanen' },
  'VlaardingseBanen':           { dbName: 'VlaardingeseBanen' },
  'WeerterBanen':               { dbName: 'WeerterseBanen' },
  'WoerdseBanen':               { dbName: 'WoerdenseBanen' },
  'EmmenseBanen':               { dbName: 'Emmensebanen' },
  'LeeuwardenseBanen':          { dbName: 'LeeuwardseBanen' },
  'OsseBanen':                  { dbName: 'OssseBanen', configSlug: 'ossensebanen' },
}

// ZIP-folders zonder DB-record (skip)
const ZIP_NO_DB_MATCH = new Set([
  'BARseBanen', 'BrabantseBanen', 'DrentseBanen', 'FlevolandseBanen',
  'FriesseBanen', 'HortiBanen', 'LimburgseBanen', 'RoermondseBanen',
  'Vacature Westland', 'WaalwijkseBanen', 'WaterwegseBanen',
  'WerkenInAalsmeer', 'WestlandseStages', 'ZeelandseBanen',
  'ZuidhollandseBanen',
])

// ─────────────────────────────────────────────────────────────────────────────
// Hex utilities
// ─────────────────────────────────────────────────────────────────────────────

function parseHex(hex) {
  const trimmed = hex.trim().replace(/^#/, '')
  // Expand 3-char shorthand (#abc → #aabbcc)
  const full = trimmed.length === 3
    ? trimmed.split('').map(c => c + c).join('')
    : trimmed
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full)
  if (!m) return null
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

function colorMatches(a, b, tolerance = 30) {
  const A = parseHex(a)
  const B = parseHex(b)
  if (!A || !B) return false
  return A.every((v, i) => Math.abs(v - B[i]) <= tolerance)
}

function colorDistance(a, b) {
  const A = parseHex(a)
  const B = parseHex(b)
  if (!A || !B) return Infinity
  return Math.sqrt(A.reduce((sum, v, i) => sum + (v - B[i]) ** 2, 0))
}

/** WCAG relative luminance, 0..1. Donkerder = lager. */
function luminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return 0.5
  const toLinear = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract alle unieke hex-fills uit een SVG. Pakt zowel `fill: #xxx` als
 * `fill="#xxx"` varianten. Returns lowercase 6-char hex strings.
 */
function extractFills(svg) {
  const fills = new Set()
  const RE = /fill\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8})/g
  let m
  while ((m = RE.exec(svg)) !== null) {
    let hex = m[1].toLowerCase()
    // Negeer alpha-channels en wit/zwart als ze als highlights gebruikt worden
    // (we mappen alleen de 2 brand-fills)
    if (hex.length === 4) {
      // #abc → #aabbcc
      hex = '#' + hex.slice(1).split('').map(c => c + c).join('')
    } else if (hex.length === 9) {
      // #aarrggbb of #rrggbbaa → strip alpha
      hex = hex.slice(0, 7)
    }
    fills.add(hex)
  }
  return [...fills]
}

/**
 * Bepaal voor de gegeven fills welke primary is en welke secondary.
 * Returnt { primary: hex, secondary: hex, mode: 'config' | 'heuristic' }.
 */
function classifyFills(fills, configEntry) {
  // Strategie A: portals-config match
  if (configEntry) {
    const matchPrimary = fills.find(f => colorMatches(f, configEntry.primary))
    const matchSecondary = fills.find(f => colorMatches(f, configEntry.secondary))
    if (matchPrimary && matchSecondary && matchPrimary !== matchSecondary) {
      return { primary: matchPrimary, secondary: matchSecondary, mode: 'config' }
    }
  }

  // Strategie B: luminance-heuristiek (donkerste fill = primary)
  // Filter out pure wit en bijna-wit (mogelijke highlights)
  const candidates = fills.filter(f => {
    const L = luminance(f)
    return L < 0.92 // sluit wit-achtig uit
  })

  if (candidates.length >= 2) {
    const sorted = [...candidates].sort((a, b) => luminance(a) - luminance(b))
    return { primary: sorted[0], secondary: sorted[sorted.length - 1], mode: 'heuristic' }
  }

  if (candidates.length === 1) {
    return { primary: candidates[0], secondary: null, mode: 'heuristic-single' }
  }

  return { primary: null, secondary: null, mode: 'none' }
}

/**
 * Vervang in een SVG-string alle voorkomens van een specifieke fill door
 * een nieuwe waarde. Vervangt zowel `fill:hex`, `fill: hex`, `fill="hex"`,
 * en de 3-char shorthand-vorm (#abc) als die in de SVG voorkomt.
 */
function replaceFill(svg, hex, replacement) {
  const variants = [hex.toLowerCase(), hex.toUpperCase()]

  // 3-char shorthand variant als alle 3 bytes herhaalde nibbles zijn (#aabbcc → #abc)
  const expanded = hex.toLowerCase().slice(1)
  if (
    expanded.length === 6 &&
    expanded[0] === expanded[1] &&
    expanded[2] === expanded[3] &&
    expanded[4] === expanded[5]
  ) {
    const short = '#' + expanded[0] + expanded[2] + expanded[4]
    variants.push(short, short.toUpperCase())
  }

  let out = svg
  for (const variant of variants) {
    const escaped = variant.replace(/[#]/g, '\\#')
    // fill: #xxx (CSS-syntax in <style>)
    out = out.replace(new RegExp(`fill\\s*:\\s*${escaped}`, 'g'), `fill: ${replacement}`)
    // fill="#xxx" (attribute-syntax)
    out = out.replace(new RegExp(`fill\\s*=\\s*"${escaped}"`, 'g'), `fill="${replacement}"`)
    out = out.replace(new RegExp(`fill\\s*=\\s*'${escaped}'`, 'g'), `fill='${replacement}'`)
  }
  return out
}

/**
 * Master logo (LokaleBanen) — geen per-tenant theming. Behoudt eigen kleuren.
 */
function processMaster() {
  const masterPath = path.join(
    REPO_ROOT,
    '.branding-staging/zip1/2026 LokaleBanen/final/lokalebanen_logo_2026.svg'
  )
  if (!fs.existsSync(masterPath)) {
    console.warn('  ⚠ Master logo niet gevonden:', masterPath)
    return false
  }
  const svg = fs.readFileSync(masterPath, 'utf-8')
  fs.writeFileSync(path.join(OUT_DIR, '_master.svg'), svg)
  console.log('  ✓ _master.svg (LokaleBanen master)')
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const allFolders = new Set()
  for (const dir of ZIP_DIRS) {
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir)) {
      if (entry === '2026 LokaleBanen' || entry === 'LokaleBanen' || entry.startsWith('portals')) continue
      const full = path.join(dir, entry)
      if (fs.statSync(full).isDirectory()) allFolders.add(entry)
    }
  }

  const stats = {
    processedConfig: 0,
    processedHeuristic: 0,
    skippedNoDbMatch: 0,
    skippedNoSvg: 0,
    skippedNoFills: 0,
    log: [],
  }

  for (const folder of [...allFolders].sort()) {
    if (ZIP_NO_DB_MATCH.has(folder)) {
      stats.skippedNoDbMatch++
      continue
    }

    const explicit = ZIP_TO_DB[folder] || {}
    const dbName = explicit.dbName || folder
    const configSlug = explicit.configSlug || folder.toLowerCase()
    const config = PORTALS_CONFIG[configSlug] || null

    const folderPath = ZIP_DIRS
      .map(d => path.join(d, folder))
      .find(p => fs.existsSync(p))
    if (!folderPath) {
      stats.skippedNoSvg++
      continue
    }

    // Naming-conventies: `logo_<slug>_2025.svg` of `<Name>_Logo.svg`
    const allSvgs = fs.readdirSync(folderPath).filter(f => f.endsWith('.svg'))
    const svgFile = allSvgs.find(f => /^logo_/i.test(f))
                 || allSvgs.find(f => /_Logo\.svg$/i.test(f) && !/_carnaval/i.test(f))
                 || allSvgs.find(f => /_Logo\.svg$/i.test(f))
    if (!svgFile) {
      stats.skippedNoSvg++
      continue
    }

    const svg = fs.readFileSync(path.join(folderPath, svgFile), 'utf-8')
    const fills = extractFills(svg)
    const classification = classifyFills(fills, config)

    if (!classification.primary) {
      console.log(`  ⚠ ${folder}: geen bruikbare fills (${fills.join(', ')})`)
      stats.skippedNoFills++
      continue
    }

    let out = svg
    out = replaceFill(out, classification.primary, 'var(--primary)')
    if (classification.secondary) {
      out = replaceFill(out, classification.secondary, 'var(--secondary)')
    }

    fs.writeFileSync(path.join(OUT_DIR, `${dbName}.svg`), out)

    const tag = classification.mode === 'config' ? '✓' : '⚙'
    const note = classification.mode === 'config'
      ? '(config)'
      : `(luminance: P=${classification.primary}, S=${classification.secondary || '—'})`
    console.log(`  ${tag} ${dbName}.svg ${note}`)

    if (classification.mode === 'config') stats.processedConfig++
    else stats.processedHeuristic++

    stats.log.push({ folder, dbName, mode: classification.mode, primary: classification.primary, secondary: classification.secondary })
  }

  processMaster()

  console.log('\n─── Summary ───')
  console.log(`Processed via config:    ${stats.processedConfig}`)
  console.log(`Processed via heuristic: ${stats.processedHeuristic}`)
  console.log(`Skipped (no DB match):   ${stats.skippedNoDbMatch}`)
  console.log(`Skipped (no SVG):        ${stats.skippedNoSvg}`)
  console.log(`Skipped (no fills):      ${stats.skippedNoFills}`)
  console.log(`Total written:           ${stats.processedConfig + stats.processedHeuristic + 1}`)
}

main()
