#!/usr/bin/env node
// Genereert een HTML-preview: per platform zie je logo + primary/secondary swatches + button/card mockup.

import fs from 'node:fs'
import path from 'node:path'

const PROPOSALS = '/Users/kennylipman/Lokale-Banen/.branding-staging/color-proposal.json'
const STAGING = '/Users/kennylipman/Lokale-Banen/.branding-staging'
const OUT_HTML = path.join(STAGING, 'BRANDING-PREVIEW.html')

const proposals = JSON.parse(fs.readFileSync(PROPOSALS, 'utf8'))

function findSvgPath(regio_platform, zipFolder) {
  const tryPaths = [
    path.join(STAGING, 'zip1', zipFolder),
    path.join(STAGING, 'zip2', zipFolder),
  ]
  for (const d of tryPaths) {
    if (!fs.existsSync(d)) continue
    const files = fs.readdirSync(d)
    const logo = files.find(f => /^logo_.*\.svg$/i.test(f) && !/_txt\.svg$/i.test(f))
      || files.find(f => /_Logo\.svg$/i.test(f))
    if (logo) return path.join(d, logo)
  }
  return null
}

function readSvgInline(svgPath) {
  if (!svgPath) return '<div class="no-logo">geen logo</div>'
  try {
    let svg = fs.readFileSync(svgPath, 'utf8')
    // Strip XML declaration + comments
    svg = svg.replace(/<\?xml[^>]*\?>\s*/g, '')
    svg = svg.replace(/<!--[\s\S]*?-->/g, '')
    // Force max size
    svg = svg.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
      // Remove fixed width/height, let CSS handle
      attrs = attrs.replace(/\s(width|height)="[^"]*"/gi, '')
      return `<svg${attrs} style="max-width:100%;max-height:80px;display:block">`
    })
    return svg
  } catch {
    return '<div class="no-logo">fout bij lezen</div>'
  }
}

const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Lokale Banen — Branding Preview</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 0; background: #f5f5f7; color: #1d1d1f; }
  header { padding: 2rem; background: white; border-bottom: 1px solid #e5e5e7; }
  h1 { margin: 0 0 0.5rem; font-size: 1.75rem; }
  .meta { color: #666; font-size: 0.9rem; }
  .section-title { padding: 1.5rem 2rem 0.5rem; font-size: 1.2rem; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; padding: 1rem 2rem 4rem; }
  .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .card-header { padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  .name { font-weight: 600; font-size: 0.95rem; }
  .status { font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
  .status.live { background: #d4f4dd; color: #0e6b2b; }
  .status.draft { background: #f0f0f0; color: #666; }
  .logo-area { background: white; padding: 1.5rem; display: flex; justify-content: center; align-items: center; min-height: 120px; border-bottom: 1px solid #f5f5f7; }
  .logo-area svg { max-width: 80%; max-height: 80px; }
  .colors { display: flex; padding: 0.75rem; gap: 0.5rem; background: #fafafa; }
  .swatch { flex: 1; border-radius: 6px; padding: 0.5rem; min-height: 60px; display: flex; flex-direction: column; justify-content: flex-end; color: white; font-size: 0.75rem; font-family: ui-monospace, 'SF Mono', monospace; }
  .swatch.empty { background: repeating-linear-gradient(45deg, #f0f0f0, #f0f0f0 10px, #ddd 10px, #ddd 20px); color: #666; }
  .swatch-label { opacity: 0.85; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .swatch-hex { font-weight: 600; }
  .mockup { padding: 1rem; border-top: 1px solid #f5f5f7; display: flex; gap: 0.5rem; align-items: center; font-size: 0.8rem; }
  .btn { padding: 0.4rem 0.9rem; border-radius: 6px; font-weight: 500; font-size: 0.85rem; color: white; border: none; cursor: pointer; }
  .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; color: white; font-weight: 500; }
  .source { padding: 0.4rem 1rem; background: #fafafa; border-top: 1px solid #f5f5f7; font-size: 0.7rem; color: #666; text-align: right; }
  .source.kay { background: #fef3c7; color: #78350f; }
  .source.svg { background: #e0e7ff; color: #3730a3; }
</style>
</head>
<body>
<header>
  <h1>Lokale Banen — Branding Preview</h1>
  <div class="meta">
    ${proposals.length} platforms ·
    <strong>${proposals.filter(p => p.source === 'kay-official').length}</strong> met Kay-officieel ·
    <strong>${proposals.filter(p => p.source !== 'kay-official').length}</strong> met SVG-geëxtraheerde kleuren
  </div>
</header>

<div class="section-title">🟢 Live platforms (is_public=true)</div>
<div class="grid">
${proposals.filter(p => p.is_public).map(p => renderCard(p)).join('')}
</div>

<div class="section-title">⚪ Draft platforms (is_public=false)</div>
<div class="grid">
${proposals.filter(p => !p.is_public).map(p => renderCard(p)).join('')}
</div>

</body>
</html>`

function renderCard(p) {
  const svgPath = findSvgPath(p.regio_platform, p.zip_folder)
  const svgInline = readSvgInline(svgPath)
  const primary = p.primary
  const secondary = p.secondary
  const statusClass = p.is_public ? 'live' : 'draft'
  const statusLabel = p.is_public ? 'LIVE' : 'draft'
  const sourceClass = p.source === 'kay-official' ? 'kay' : 'svg'
  const sourceLabel = p.source === 'kay-official' ? 'Kay officieel' : p.source === 'svg-extracted' ? 'SVG-extractie (2 kleuren)' : 'SVG-extractie (1 kleur)'
  return `
  <div class="card">
    <div class="card-header">
      <div class="name">${p.regio_platform}${p.zip_folder !== p.regio_platform ? ` <span style="color:#999;font-weight:400;font-size:0.8em">(ZIP: ${p.zip_folder})</span>` : ''}</div>
      <div class="status ${statusClass}">${statusLabel}</div>
    </div>
    <div class="logo-area">${svgInline}</div>
    <div class="colors">
      ${primary ? `<div class="swatch" style="background:${primary}"><div class="swatch-label">Primair</div><div class="swatch-hex">${primary}</div></div>` : '<div class="swatch empty">geen primary</div>'}
      ${secondary ? `<div class="swatch" style="background:${secondary}"><div class="swatch-label">Secundair</div><div class="swatch-hex">${secondary}</div></div>` : '<div class="swatch empty">geen secondary</div>'}
    </div>
    <div class="mockup">
      ${primary ? `<button class="btn" style="background:${primary}">Bekijk vacatures</button>` : ''}
      ${secondary ? `<span class="badge" style="background:${secondary}">Nieuw</span>` : ''}
    </div>
    <div class="source ${sourceClass}">${sourceLabel}${p.domain ? ` · ${p.domain}` : ''}</div>
  </div>`
}

fs.writeFileSync(OUT_HTML, html)
console.log(`Preview: file://${OUT_HTML}`)
