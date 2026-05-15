#!/usr/bin/env node
/**
 * CBS PC4 → cities import script
 *
 * Importeert alle Nederlandse PC4-postcodes met plaatsnaam in de cities-tabel.
 * Bestaande rijen worden NIET overschreven (partial unique index op
 * (plaats, postcode) waar platform_id IS NULL).
 *
 * Auto-suggest: voor nieuwe rijen waarvan de PC4-prefix uniek matcht naar
 * 1 platform in bestaande cities-data wordt platform_id direct ingevuld.
 *
 * Bron: bobdenotter/4pp (MIT, ~4.000 rijen, PC4 + plaats + gemeente).
 * Format: `id,postcode,"woonplaats","alternatieve","gemeente","provincie","netnummer",lat,lon,"soort"`
 *
 * Usage:
 *   pnpm tsx scripts/import-cbs-pc4.mjs
 *   pnpm tsx scripts/import-cbs-pc4.mjs ./local-pc4.csv
 *   CBS_PC4_URL=https://... pnpm tsx scripts/import-cbs-pc4.mjs
 *
 * Env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const DEFAULT_SOURCE_URL =
  'https://raw.githubusercontent.com/bobdenotter/4pp/master/4pp.csv'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Quote-aware CSV line parser (RFC 4180 minimal subset)
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const header = parseCsvLine(lines[0]).map((s) => s.trim().toLowerCase())
  const idx = {
    postcode: header.indexOf('postcode'),
    plaats: header.indexOf('woonplaats'),
    gemeente: header.indexOf('gemeente'),
    provincie: header.indexOf('provincie'),
    soort: header.indexOf('soort'),
  }
  if (idx.postcode < 0 || idx.plaats < 0) {
    throw new Error(
      `CSV-header mist postcode of woonplaats kolom. Gevonden: ${header.join(', ')}`,
    )
  }

  // Filter: Postbus-postcodes uitsluiten (geen echte woonplaats)
  // Dedup op (postcode, plaats-lc); eerste niet-Postbus rij wint
  const seen = new Map() // key → row
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]).map((s) => s.trim())
    const postcode = cells[idx.postcode]
    const plaats = cells[idx.plaats]
    const soort = idx.soort >= 0 ? cells[idx.soort] : ''
    if (!postcode || !plaats) continue
    if (!/^\d{4}$/.test(postcode)) continue
    if (soort === 'Postbus') continue

    const key = `${postcode}|${plaats.toLowerCase()}`
    if (!seen.has(key)) {
      seen.set(key, {
        postcode,
        plaats,
        gemeente: idx.gemeente >= 0 ? cells[idx.gemeente] : null,
        provincie: idx.provincie >= 0 ? cells[idx.provincie] : null,
      })
    }
  }
  return [...seen.values()]
}

async function fetchCsv(source) {
  if (source.startsWith('http')) {
    console.log(`Downloaden van ${source}`)
    const res = await fetch(source)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} bij ${source}`)
    }
    return await res.text()
  }
  console.log(`Lezen van bestand ${source}`)
  return await readFile(source, 'utf-8')
}

async function buildPlatformSuggestionMap() {
  // PC4-prefix → platform_id, alleen waar uniek (count(distinct platform_id) = 1)
  const byPc4 = new Map()
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('cities')
      .select('postcode, platform_id')
      .not('platform_id', 'is', null)
      .not('postcode', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`platform-suggestie load: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      if (!row.postcode || !row.platform_id) continue
      const pc4 = row.postcode.substring(0, 4)
      if (!byPc4.has(pc4)) byPc4.set(pc4, new Set())
      byPc4.get(pc4).add(row.platform_id)
    }
    if (data.length < pageSize) break
    from += pageSize
  }

  const unique = new Map()
  for (const [pc4, set] of byPc4) {
    if (set.size === 1) {
      unique.set(pc4, [...set][0])
    }
  }
  return unique
}

async function loadExistingCities() {
  // Pagineer: Supabase heeft default-limit van 1000 rijen per query
  const exactKeys = new Set()
  const mappedAt = new Set()
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('cities')
      .select('plaats, postcode, platform_id')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`existing cities load: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data) {
      const key = `${row.plaats.toLowerCase()}|${row.postcode ?? ''}`
      exactKeys.add(`${key}|${row.platform_id ?? '_null'}`)
      if (row.platform_id) mappedAt.add(key)
    }
    if (data.length < pageSize) break
    from += pageSize
  }
  return { exactKeys, mappedAt }
}

async function main() {
  const arg = process.argv[2]
  const source = arg || process.env.CBS_PC4_URL || DEFAULT_SOURCE_URL

  console.log('═════════════════════════════════════════════')
  console.log(' CBS PC4 → cities import')
  console.log('═════════════════════════════════════════════')

  const csv = await fetchCsv(source)
  const rows = parseCsv(csv)
  console.log(`Gevonden in CSV (na dedup + Postbus-filter): ${rows.length} rijen`)

  const suggestionMap = await buildPlatformSuggestionMap()
  console.log(`Platform-suggesties beschikbaar voor ${suggestionMap.size} PC4-prefixes`)

  const { exactKeys, mappedAt } = await loadExistingCities()
  console.log(`Bestaande cities-rijen: exact-keys ${exactKeys.size}, mapped-at ${mappedAt.size}`)

  // Selecteer toe-te-voegen rijen. We dedupliceren extra in-batch op
  // (plaats_lc, postcode) om partial-unique-index 23505 op case-sensitivity te voorkomen
  // (cities_uniq_unmapped is case-sensitive op plaats).
  const toInsert = []
  const batchKeys = new Set()
  for (const r of rows) {
    const platformId = suggestionMap.get(r.postcode) ?? null
    const baseKey = `${r.plaats.toLowerCase()}|${r.postcode}`

    if (mappedAt.has(baseKey)) continue
    const exact = `${baseKey}|${platformId ?? '_null'}`
    if (exactKeys.has(exact)) continue
    if (batchKeys.has(baseKey)) continue
    batchKeys.add(baseKey)

    toInsert.push({
      plaats: r.plaats,
      postcode: r.postcode,
      platform_id: platformId,
      is_active: false,
      source: 'cbs_pc4',
    })
  }

  const autoSuggested = toInsert.filter((r) => r.platform_id).length
  console.log('')
  console.log(`Te inserten: ${toInsert.length}`)
  console.log(`  → met auto-platform via PC4-prefix: ${autoSuggested}`)
  console.log(`  → zonder platform (UI-koppeling): ${toInsert.length - autoSuggested}`)
  console.log('')

  if (toInsert.length === 0) {
    console.log('Niets te doen — alles is al in cities.')
    return
  }

  // Batch insert
  let inserted = 0
  let conflicts = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { error, count } = await supabase
      .from('cities')
      .insert(batch, { count: 'exact' })
    if (error) {
      if (error.code === '23505') {
        conflicts += batch.length
        console.warn(`Batch ${i}-${i + batch.length}: conflict, geskipt`)
        continue
      }
      console.error(`Batch ${i}-${i + batch.length} fout:`, error.message)
      throw error
    }
    inserted += count ?? batch.length
    process.stdout.write(`\rGeïnserteerd: ${inserted}/${toInsert.length}`)
  }
  console.log('')
  console.log('═════════════════════════════════════════════')
  console.log(` Klaar: ${inserted} ingevoegd, ${conflicts} geskipt (conflict)`)
  console.log('═════════════════════════════════════════════')
}

main().catch((err) => {
  console.error('Import fout:', err)
  process.exit(1)
})
