/**
 * Test-script voor werkenindekempen.nl scraper (dry-run, geen DB-writes).
 *
 * Doel:
 *   1. Sitemap inlezen, 1 vacature-URL kiezen (of via CLI-arg) en detailpagina fetchen
 *   2. JSON-LD JobPosting + URL-segmenten + content_hash extracten
 *   3. Mapping tonen naar `companies`, `job_postings`, `contacts` kolommen
 *   4. Lookup bestaande company (normalized_name + indeed_url/url) voor dedup-inzicht
 *
 * Run:
 *   node scripts/test-werkenindekempen.mjs                    # pakt random recente URL uit sitemap
 *   node scripts/test-werkenindekempen.mjs <vacature-url>     # specifieke URL
 *   node scripts/test-werkenindekempen.mjs --n=5              # parseer 5 recente vacatures
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import crypto from 'crypto'

// ── Env ─────────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8').split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=')
      if (idx < 0) return [null, null]
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, '')]
    })
    .filter(([k]) => k)
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const HAS_DB = Boolean(SUPABASE_URL && SERVICE_KEY)

async function dbGet(path) {
  if (!HAS_DB) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) return null
  const arr = await res.json()
  return Array.isArray(arr) ? arr[0] || null : arr
}

const SITEMAP_URL = 'https://www.werkenindekempen.nl/sitemap-wik-vacancies.xml'
const UA = 'Mozilla/5.0 (compatible; LokaleBanen/1.0; +https://lokale-banen-app.vercel.app)'

// ── CLI args ────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const urlArg = args.find(a => a.startsWith('http'))
const nMatch = args.find(a => a.startsWith('--n='))
const N = nMatch ? parseInt(nMatch.slice(4), 10) : 1

// ── Helpers ─────────────────────────────────────────────────────────
function normalizeName(name) {
  if (!name) return ''
  return name.toLowerCase()
    .replace(/\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|bvba|sa|gmbh|ltd|inc|llc|corp|holding|group|nederland|netherlands)\b/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim()
}

function contentHash(title, company, city, url) {
  return crypto.createHash('sha256')
    .update(`${title}|${company}|${city}|${url}`)
    .digest('hex')
    .slice(0, 16)
}

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
}

function parseUrlSegments(url) {
  // /vacatures/{slug}-{job_id}-{unix_ts}-c{company_id}
  const m = url.match(/\/vacatures\/(.+?)-(\d+)-(\d+)-c(\d+)$/)
  if (!m) return null
  return { slug: m[1], jobId: m[2], unixTs: parseInt(m[3], 10), companyExtId: m[4] }
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} bij ${url}`)
  return await res.text()
}

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  for (const b of blocks) {
    try {
      const obj = JSON.parse(b[1].trim())
      const items = Array.isArray(obj) ? obj : [obj]
      const jp = items.find(x => x && x['@type'] === 'JobPosting')
      if (jp) return jp
    } catch { /* skip */ }
  }
  return null
}

function parseSitemap(xml) {
  const entries = []
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g
  let m
  while ((m = re.exec(xml)) !== null) {
    if (/\/vacatures\/[a-z0-9-]+-\d+-\d+-c\d+$/.test(m[1])) {
      entries.push({ url: m[1], lastmod: m[2] })
    }
  }
  return entries
}

// ── Mapping logic ───────────────────────────────────────────────────
function buildMapping(jp, url) {
  const seg = parseUrlSegments(url)
  const org = jp.hiringOrganization || {}
  const loc = jp.jobLocation || {}
  const addr = loc.address || {}
  const baseSalary = jp.baseSalary || {}
  const salaryVal = baseSalary.value || {}

  // employmentType kan een JSON-string array zijn (zoals we zagen: "[\"FULL_TIME\", \"PART_TIME\"]")
  let employmentTypes = []
  if (typeof jp.employmentType === 'string') {
    try { employmentTypes = JSON.parse(jp.employmentType) }
    catch { employmentTypes = [jp.employmentType] }
  } else if (Array.isArray(jp.employmentType)) {
    employmentTypes = jp.employmentType
  }
  const employmentLabel = employmentTypes.includes('FULL_TIME') && employmentTypes.includes('PART_TIME')
    ? 'Fulltime/Parttime'
    : employmentTypes.includes('FULL_TIME') ? 'Fulltime'
    : employmentTypes.includes('PART_TIME') ? 'Parttime' : null

  // Salary parsing: "2580.00 - 4000.00" of "2580.00"
  let salaryStr = null, salaryMin = null, salaryMax = null
  const rawSal = salaryVal.value
  if (typeof rawSal === 'string' && rawSal.includes('-')) {
    const [a, b] = rawSal.split('-').map(s => parseFloat(s.trim()))
    salaryMin = isFinite(a) ? a : null
    salaryMax = isFinite(b) ? b : null
  } else if (rawSal != null) {
    salaryMin = parseFloat(rawSal) || null
  }
  if (salaryMin != null) {
    const fmt = n => n.toLocaleString('nl-NL', { style: 'currency', currency: salaryVal.currency || baseSalary.currency || 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
    const periodMap = { MONTH: 'per maand', YEAR: 'per jaar', HOUR: 'per uur', WEEK: 'per week' }
    const period = periodMap[salaryVal.unitText || baseSalary.unitText] || ''
    salaryStr = salaryMax != null ? `${fmt(salaryMin)} - ${fmt(salaryMax)}${period ? ' ' + period : ''}` : `${fmt(salaryMin)}${period ? ' ' + period : ''}`
  }

  const descriptionHtml = jp.description || ''
  const descriptionPlain = stripHtml(descriptionHtml)
  const city = addr.addressLocality ? addr.addressLocality.replace(/\b\w/g, c => c.toUpperCase()) : null

  const company = {
    name: org.name || null,
    normalized_name: normalizeName(org.name),
    website: org.sameAs || null,
    logo_url: org.logo || null,
    city,
    street_address: addr.streetAddress || null,
    postal_code: addr.postalCode || null,
    state: addr.addressRegion || null,
    country: addr.addressCountry || null,
    location: city,
    source_external_id: seg ? `wik-c${seg.companyExtId}` : null,  // referentie naar werkenindekempen company-id
    status: 'Prospect',
    enrichment_status: 'pending',
    qualification_status: 'pending',
  }

  const jobPosting = {
    title: jp.title || null,
    description: descriptionHtml,
    url,
    external_vacancy_id: seg?.jobId || null,
    // location
    city,
    state: addr.addressRegion || null,
    country: addr.addressCountry === 'NL' ? 'Netherlands' : addr.addressCountry,
    zipcode: addr.postalCode || null,
    street: addr.streetAddress || null,
    // job details
    job_type: employmentTypes,                    // ARRAY
    employment: employmentLabel,
    salary: salaryStr,
    // dates
    published_at: jp.datePosted || null,
    created_at: jp.datePosted || null,
    end_date: jp.validThrough || null,
    scraped_at: new Date().toISOString(),
    // dedup
    content_hash: contentHash(jp.title || '', org.name || '', city || '', url),
    status: 'new',
    review_status: 'pending',
  }

  // Contact: JSON-LD bevat geen contactpersoon → leeg (later via Mistral op description)
  const contact = null

  return { url, seg, company, jobPosting, contact, salaryMin, salaryMax, descriptionLength: descriptionPlain.length }
}

// ── Lookup in DB voor inzicht ──────────────────────────────────────
async function lookupExistingCompany(mapping) {
  if (!mapping.company.normalized_name) return null
  const q = new URLSearchParams({
    normalized_name: `eq.${mapping.company.normalized_name}`,
    select: 'id,name,website,city,job_counts,status,pipedrive_synced,enrichment_status,apollo_contacts_count',
    limit: '1',
  })
  return dbGet(`companies?${q}`)
}

async function lookupExistingJob(mapping) {
  if (!mapping.jobPosting.external_vacancy_id) return null
  const q = new URLSearchParams({
    external_vacancy_id: `eq.${mapping.jobPosting.external_vacancy_id}`,
    select: 'id,title,source_id,external_vacancy_id,created_at,status',
    limit: '1',
  })
  return dbGet(`job_postings?${q}`)
}

// ── Main ────────────────────────────────────────────────────────────
async function processUrl(url, idx) {
  console.log(`\n${'═'.repeat(80)}\n# ${idx ? `[${idx}] ` : ''}${url}\n${'═'.repeat(80)}`)
  const html = await fetchText(url)
  const jp = extractJsonLd(html)
  if (!jp) {
    console.error('GEEN JSON-LD JobPosting gevonden in HTML')
    return
  }
  const mapping = buildMapping(jp, url)

  console.log('\n── URL-segmenten ──')
  console.log(mapping.seg)

  console.log('\n── companies-mapping ──')
  for (const [k, v] of Object.entries(mapping.company)) {
    const display = v == null ? '∅' : typeof v === 'string' && v.length > 80 ? v.slice(0, 77) + '...' : v
    console.log(`  ${k.padEnd(20)} → ${display}`)
  }

  console.log('\n── job_postings-mapping ──')
  for (const [k, v] of Object.entries(mapping.jobPosting)) {
    let display
    if (v == null) display = '∅'
    else if (Array.isArray(v)) display = `[${v.join(', ')}]`
    else if (typeof v === 'string' && v.length > 80) display = v.slice(0, 77) + '...'
    else display = v
    console.log(`  ${k.padEnd(20)} → ${display}`)
  }

  console.log(`\n── description ── (${mapping.descriptionLength} chars plain)`)
  console.log('  ' + stripHtml(jp.description).slice(0, 300) + '...')

  console.log('\n── salary parsing ──')
  const rawSalRaw = jp.baseSalary?.value?.value
  const rawSalUnit = jp.baseSalary?.value?.unitText || jp.baseSalary?.unitText
  console.log(`  raw: ${rawSalRaw == null ? '∅' : `"${rawSalRaw}"`} (${rawSalUnit ?? '∅'})`)
  console.log(`  → min: ${mapping.salaryMin ?? '∅'}, max: ${mapping.salaryMax ?? '∅'}, label: ${mapping.jobPosting.salary ?? '∅'}`)

  if (HAS_DB) {
    console.log('\n── DB lookup ──')
    const [existingCompany, existingJob] = await Promise.all([
      lookupExistingCompany(mapping),
      lookupExistingJob(mapping),
    ])
    if (existingCompany) {
      console.log(`  ✓ Bestaande company gevonden (id=${existingCompany.id.slice(0, 8)}…):`)
      console.log(`    name="${existingCompany.name}" website=${existingCompany.website || '∅'} job_counts=${existingCompany.job_counts}`)
      console.log(`    status=${existingCompany.status} enrichment=${existingCompany.enrichment_status} apollo_contacts=${existingCompany.apollo_contacts_count}`)
    } else {
      console.log('  ⊘ Geen bestaande company op normalized_name → NIEUW record nodig')
    }
    if (existingJob) {
      console.log(`  ⚠ Bestaande job_posting met external_vacancy_id=${mapping.jobPosting.external_vacancy_id} → SKIP`)
    } else {
      console.log(`  ⊘ Geen bestaande job_posting → NIEUW record nodig`)
    }
  } else {
    console.log('\n(geen .env.local supabase keys — DB-lookup overgeslagen)')
  }

  console.log('\n── Velden die NIET uit JSON-LD komen (vereist Mistral/enrichment) ──')
  console.log('  contacts.name/email/phone/title  ← Mistral op description (zoals baanindebuurt)')
  console.log('  companies.phone                  ← website-enrichment (WebsiteService)')
  console.log('  companies.kvk / rechtsvorm       ← KVK-API of website enrichment')
  console.log('  job_postings.education_level     ← Mistral op description')
  console.log('  job_postings.career_level        ← Mistral op description')
  console.log('  job_postings.working_hours_min/max ← Mistral of regex op description')
  console.log('  job_postings.categories          ← Mistral classificatie of mapping op werkenindekempen-filters')
}

async function main() {
  if (urlArg) {
    await processUrl(urlArg)
    return
  }
  console.log(`Fetch sitemap: ${SITEMAP_URL}`)
  const xml = await fetchText(SITEMAP_URL)
  const all = parseSitemap(xml)
  // Sort by lastmod desc en pak top N
  const recent = all.sort((a, b) => b.lastmod.localeCompare(a.lastmod)).slice(0, N)
  console.log(`Sitemap: ${all.length} detail-URLs gevonden. Test op ${recent.length} meest recente.`)
  for (let i = 0; i < recent.length; i++) {
    await processUrl(recent[i].url, i + 1)
    if (i < recent.length - 1) await new Promise(r => setTimeout(r, 500))
  }
}

main().catch(err => {
  console.error('\nFATAL:', err)
  process.exit(1)
})
