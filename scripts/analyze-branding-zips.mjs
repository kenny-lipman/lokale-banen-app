#!/usr/bin/env node
// Grondige inventarisatie van de branding ZIPs.
// Per portaal:
//  - welke bestandsvarianten (logo/icon/box, SVG/EPS/PNG/AI/PDF)
//  - kleuren geëxtraheerd uit SVGs (fill/stroke hex codes, stop-color)
//  - kruising met DB platforms + Kay's officiële hexcode lijst
// Output: JSON rapport + Markdown rapport in .branding-staging/

import fs from 'node:fs'
import path from 'node:path'

const STAGING = '/Users/kennylipman/Lokale-Banen/.branding-staging'
const ZIP1_DIR = path.join(STAGING, 'zip1')
const ZIP2_DIR = path.join(STAGING, 'zip2')
const KAY_TXT = path.join(STAGING, 'zip2', 'portals in hexcode Kay.txt')

const FILE_ROLE_RULES = [
  { pattern: /_box\.(svg|eps|ai|pdf|png)$/i, role: 'box' },
  { pattern: /^icon_.*\.(svg|eps|ai|pdf|png|jpg)$/i, role: 'icon' },
  { pattern: /_icon\.(svg|eps|ai|pdf|png)$/i, role: 'icon' },
  { pattern: /^logo_.*_txt\.(svg|ai|pdf|eps)$/i, role: 'logo_text' },
  { pattern: /^logo_.*_wit\.(svg|png|eps|pdf)$/i, role: 'logo_white' },
  { pattern: /^logo_.*_kleur\.(svg|png|eps|pdf)$/i, role: 'logo_color' },
  { pattern: /^logo_.*\.(svg|ai|pdf|eps|png|jpg)$/i, role: 'logo' },
  { pattern: /_Logo\.(svg|eps|ai|pdf|png)$/i, role: 'logo' },
  { pattern: /_Icon\.(svg|eps|ai|pdf|png)$/i, role: 'icon' },
  { pattern: /_Box\.(svg|eps|ai|pdf|png)$/i, role: 'box' },
  { pattern: /avatar.*\.psd$/i, role: 'avatar_psd' },
]

function classifyFile(filename) {
  for (const rule of FILE_ROLE_RULES) {
    if (rule.pattern.test(filename)) return rule.role
  }
  return 'other'
}

function extractHexColorsFromSvg(svgContent) {
  const colors = new Map()
  const bump = (hex) => {
    const normalized = hex.toLowerCase().replace(/^#/, '')
    if (normalized.length !== 6 && normalized.length !== 3) return
    const full = normalized.length === 3
      ? normalized.split('').map(c => c + c).join('')
      : normalized
    const key = `#${full}`
    colors.set(key, (colors.get(key) || 0) + 1)
  }
  // fill="#xxxxxx", stroke="#xxxxxx", stop-color="#xxxxxx"
  const attrRegex = /(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{3,6})/g
  let m
  while ((m = attrRegex.exec(svgContent))) bump(m[1])
  // CSS-style .className { fill: #xxx; }
  const styleRegex = /fill\s*:\s*(#[0-9a-fA-F]{3,6})/g
  while ((m = styleRegex.exec(svgContent))) bump(m[1])
  const strokeStyleRegex = /stroke\s*:\s*(#[0-9a-fA-F]{3,6})/g
  while ((m = strokeStyleRegex.exec(svgContent))) bump(m[1])
  // rgb(r,g,b) conversions
  const rgbRegex = /(?:fill|stroke)\s*[:=]\s*["']?rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g
  while ((m = rgbRegex.exec(svgContent))) {
    const toHex = (n) => Number(n).toString(16).padStart(2, '0')
    bump(`#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`)
  }
  return Array.from(colors.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([hex, count]) => ({ hex, count }))
}

// Filter uit: neutralen (zwart/wit/grijstinten) voor bepalen "merkkleur"
function isNeutral(hex) {
  const h = hex.toLowerCase()
  if (h === '#000000' || h === '#ffffff') return true
  // pure grijs: r = g = b
  const r = h.slice(1, 3), g = h.slice(3, 5), b = h.slice(5, 7)
  if (r === g && g === b) return true
  // bijna-neutraal: alle componenten binnen 10 punten
  const rv = parseInt(r, 16), gv = parseInt(g, 16), bv = parseInt(b, 16)
  if (Math.max(rv, gv, bv) - Math.min(rv, gv, bv) < 12) return true
  return false
}

function parseKayHexFile(filepath) {
  const content = fs.readFileSync(filepath, 'utf8')
  const map = {}
  const blocks = content.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 3) continue
    const portal = lines[0]
    const primaryLine = lines.find(l => /^Primair/i.test(l))
    const secondaryLine = lines.find(l => /^Secundair/i.test(l))
    if (!primaryLine || !secondaryLine) continue
    const primary = (primaryLine.match(/#[0-9a-fA-F]{6}/) || [])[0]
    const secondary = (secondaryLine.match(/#[0-9a-fA-F]{6}/) || [])[0]
    if (primary && secondary) {
      map[portal] = { primary: primary.toLowerCase(), secondary: secondary.toLowerCase() }
    }
  }
  return map
}

function listPortalsInDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}

function walkPortalFiles(portalDir) {
  const files = []
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else files.push(full)
    }
  }
  walk(portalDir)
  return files
}

function summarize(portalName, portalDir, kayColors) {
  const files = walkPortalFiles(portalDir)
  const grouped = {
    logo: [],
    logo_text: [],
    logo_white: [],
    logo_color: [],
    icon: [],
    box: [],
    avatar_psd: [],
    other: [],
  }
  for (const f of files) {
    const base = path.basename(f)
    const role = classifyFile(base)
    grouped[role] = grouped[role] || []
    grouped[role].push({
      name: base,
      ext: path.extname(f).slice(1).toLowerCase(),
      size: fs.statSync(f).size,
      path: path.relative(STAGING, f),
    })
  }
  // Extract colors: prioriteit logo > logo_color > box > icon
  const svgCandidates = [
    ...grouped.logo,
    ...grouped.logo_color,
    ...grouped.box,
    ...grouped.icon,
  ].filter(x => x.ext === 'svg')

  let colors = []
  let colorSource = null
  for (const cand of svgCandidates) {
    const full = path.join(STAGING, cand.path)
    try {
      const svg = fs.readFileSync(full, 'utf8')
      const extracted = extractHexColorsFromSvg(svg)
      if (extracted.length) {
        colors = extracted
        colorSource = cand.name
        break
      }
    } catch {}
  }
  const brandColors = colors.filter(c => !isNeutral(c.hex))
  const neutralColors = colors.filter(c => isNeutral(c.hex))
  const kay = kayColors[portalName] || null

  return {
    portal: portalName,
    has_svg_logo: grouped.logo.some(x => x.ext === 'svg'),
    has_svg_icon: grouped.icon.some(x => x.ext === 'svg'),
    has_svg_box: grouped.box.some(x => x.ext === 'svg'),
    has_eps_logo: grouped.logo.some(x => x.ext === 'eps'),
    has_ai_logo: grouped.logo.some(x => x.ext === 'ai'),
    file_counts: {
      logo: grouped.logo.length,
      icon: grouped.icon.length,
      box: grouped.box.length,
      logo_text: grouped.logo_text.length,
      other: grouped.other.length,
    },
    colors_from_svg: {
      source_file: colorSource,
      brand: brandColors.slice(0, 5),
      neutrals: neutralColors.slice(0, 3),
    },
    kay_official: kay,
    files: grouped,
  }
}

// ---- Run ----
const kayColors = parseKayHexFile(KAY_TXT)
console.log(`Kay's officiële hexcodes voor ${Object.keys(kayColors).length} portalen:`)
for (const [p, c] of Object.entries(kayColors)) {
  console.log(`  ${p}: primary=${c.primary} secondary=${c.secondary}`)
}
console.log()

const zip1Portals = listPortalsInDir(ZIP1_DIR).filter(n => !n.startsWith('2026 '))
const zip2Portals = listPortalsInDir(ZIP2_DIR)

const report = { zip1: [], zip2: [], both: [] }
for (const p of zip1Portals) {
  report.zip1.push(summarize(p, path.join(ZIP1_DIR, p), kayColors))
}
for (const p of zip2Portals) {
  const entry = summarize(p, path.join(ZIP2_DIR, p), kayColors)
  if (zip1Portals.includes(p)) {
    report.both.push({ portal: p, note: 'zit in beide ZIPs - ZIP2 is nieuwer/correcter', zip2: entry })
  } else {
    report.zip2.push(entry)
  }
}

// Schrijf JSON rapport
const outJson = path.join(STAGING, 'branding-inventory.json')
fs.writeFileSync(outJson, JSON.stringify(report, null, 2))
console.log(`JSON rapport: ${outJson}`)

// Schrijf compacte markdown
function mdTable(entries, source) {
  const lines = []
  lines.push(`\n### ${source} (${entries.length} portalen)\n`)
  lines.push(`| Portaal | SVG logo | SVG icon | SVG box | Kay kleuren | Kleur uit SVG |`)
  lines.push(`|---------|:-:|:-:|:-:|-------------|---------------|`)
  for (const e of entries) {
    const kayStr = e.kay_official
      ? `P: \`${e.kay_official.primary}\` S: \`${e.kay_official.secondary}\``
      : '–'
    const svgBrand = e.colors_from_svg.brand
      .map(c => `\`${c.hex}\`(${c.count})`)
      .join(' ')
    lines.push(`| ${e.portal} | ${e.has_svg_logo ? '✓' : '✗'} | ${e.has_svg_icon ? '✓' : '✗'} | ${e.has_svg_box ? '✓' : '✗'} | ${kayStr} | ${svgBrand || '–'} |`)
  }
  return lines.join('\n')
}

const md = [
  '# Branding ZIP Inventarisatie',
  `\n_Gegenereerd: ${new Date().toISOString()}_`,
  `\n**Totaal portalen**: ZIP1 = ${report.zip1.length}, ZIP2 = ${report.zip2.length}, overlap = ${report.both.length}`,
  `\n**Kay's officiële hexcodes**: ${Object.keys(kayColors).length} portalen`,
  mdTable(report.zip1, 'ZIP 1 — bestaande set'),
  mdTable(report.zip2, 'ZIP 2 — nieuwe/ontbrekende (met Kay hexcodes)'),
  report.both.length
    ? `\n## Overlap tussen ZIPs\n\n${report.both.map(b => `- **${b.portal}** — ${b.note}`).join('\n')}`
    : '',
].join('\n')

const outMd = path.join(STAGING, 'BRANDING-INVENTORY.md')
fs.writeFileSync(outMd, md)
console.log(`Markdown rapport: ${outMd}`)
