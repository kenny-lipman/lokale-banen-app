#!/usr/bin/env node
// Genereer voorgestelde primary/secondary kleuren per platform.
// Bronnen (in prioriteitsvolgorde):
//   1. Kay's officiële hexcode tekst (12 portalen)
//   2. Kleuren geëxtraheerd uit SVG logo (meest voorkomende niet-neutrale hex)
// Output: per DB-platform een regel met {id, regio_platform, primary, secondary, source}

import fs from 'node:fs'

const MAPPING_JSON = '/Users/kennylipman/Lokale-Banen/.branding-staging/portal-mapping.json'
const OUT_MD = '/Users/kennylipman/Lokale-Banen/.branding-staging/COLOR-PROPOSAL-V2.md'
const OUT_JSON = '/Users/kennylipman/Lokale-Banen/.branding-staging/color-proposal-v2.json'

const { mapping } = JSON.parse(fs.readFileSync(MAPPING_JSON, 'utf8'))

const proposals = []
for (const entry of mapping) {
  if (!entry.db_match) continue
  let primary, secondary, tertiary, source
  if (entry.kay_colors) {
    // Kay leverde 2 kleuren; tertiary = null (Kenny/Kay kan later bepalen)
    primary = entry.kay_colors.primary
    secondary = entry.kay_colors.secondary
    tertiary = null
    source = 'kay-official'
  } else {
    // Pak top-3 brand colors uit SVG
    const brand = entry.svg_colors || []
    primary = brand[0]?.hex || null
    secondary = brand[1]?.hex || null
    tertiary = brand[2]?.hex || null
    if (brand.length >= 3) source = 'svg-extracted-3'
    else if (brand.length === 2) source = 'svg-extracted-2'
    else if (brand.length === 1) source = 'svg-single-color'
    else source = 'no-color-found'
  }
  proposals.push({
    platform_id: entry.db_match.id,
    regio_platform: entry.db_match.regio_platform,
    domain: entry.db_match.domain,
    is_public: entry.db_match.is_public,
    primary,
    secondary,
    tertiary,
    source,
    zip_folder: entry.zip_folder,
  })
}

proposals.sort((a, b) => {
  // Public eerst, dan alfabetisch
  if (a.is_public !== b.is_public) return a.is_public ? -1 : 1
  return a.regio_platform.localeCompare(b.regio_platform)
})

// Markdown
const srcLabel = (s) => ({
  'kay-official':      '📋 Kay',
  'svg-extracted-3':   '🎨 SVG (3)',
  'svg-extracted-2':   '🎨 SVG (2)',
  'svg-single-color':  '🎨 SVG (1)',
  'no-color-found':    '❓ none',
})[s] || s

const md = []
md.push('# Brand Color Voorstel v2 — per DB Platform (3 kleuren)\n')
md.push(`_Gegenereerd: ${new Date().toISOString()}_\n`)
md.push(`**Totaal**: ${proposals.length} platforms met branding-asset\n`)
md.push(`- Kay-officieel (2 kleuren, tertiary=null): ${proposals.filter(p => p.source === 'kay-official').length}`)
md.push(`- SVG-geëxtraheerd (3 kleuren): ${proposals.filter(p => p.source === 'svg-extracted-3').length}`)
md.push(`- SVG-geëxtraheerd (2 kleuren): ${proposals.filter(p => p.source === 'svg-extracted-2').length}`)
md.push(`- SVG-geëxtraheerd (1 kleur): ${proposals.filter(p => p.source === 'svg-single-color').length}\n`)

md.push('## Live platforms (is_public=true)\n')
md.push('| Platform | Domain | Primary | Secondary | Tertiary | Bron |')
md.push('|----------|--------|---------|-----------|----------|------|')
for (const p of proposals.filter(x => x.is_public)) {
  const pc = p.primary ? `\`${p.primary}\`` : '–'
  const sc = p.secondary ? `\`${p.secondary}\`` : '–'
  const tc = p.tertiary ? `\`${p.tertiary}\`` : '–'
  md.push(`| ${p.regio_platform} | ${p.domain || '–'} | ${pc} | ${sc} | ${tc} | ${srcLabel(p.source)} |`)
}

md.push('\n## Draft platforms (is_public=false)\n')
md.push('| Platform | Primary | Secondary | Tertiary | Bron |')
md.push('|----------|---------|-----------|----------|------|')
for (const p of proposals.filter(x => !x.is_public)) {
  const pc = p.primary ? `\`${p.primary}\`` : '–'
  const sc = p.secondary ? `\`${p.secondary}\`` : '–'
  const tc = p.tertiary ? `\`${p.tertiary}\`` : '–'
  md.push(`| ${p.regio_platform} | ${pc} | ${sc} | ${tc} | ${srcLabel(p.source)} |`)
}

// SQL snippet voor de migratie
md.push('\n## SQL preview (update statements)\n')
md.push('```sql')
for (const p of proposals.filter(x => x.primary)) {
  const parts = [`primary_color = '${p.primary}'`]
  if (p.secondary) parts.push(`secondary_color = '${p.secondary}'`)
  if (p.tertiary) parts.push(`tertiary_color = '${p.tertiary}'`)
  md.push(`UPDATE platforms SET ${parts.join(', ')} WHERE id = '${p.platform_id}'; -- ${p.regio_platform}`)
}
md.push('```')

fs.writeFileSync(OUT_MD, md.join('\n'))
fs.writeFileSync(OUT_JSON, JSON.stringify(proposals, null, 2))
console.log(`Color proposal: ${OUT_MD}`)
console.log(`Color proposal JSON: ${OUT_JSON}`)
console.log(`\n=== Summary ===`)
console.log(`Live platforms:   ${proposals.filter(p => p.is_public).length}`)
console.log(`Draft platforms:  ${proposals.filter(p => !p.is_public).length}`)
console.log(`With Kay colors:  ${proposals.filter(p => p.source === 'kay-official').length}`)
console.log(`Fallback to SVG:  ${proposals.filter(p => p.source !== 'kay-official').length}`)
