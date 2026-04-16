/**
 * Content Enrichment Pipeline
 * Structures raw vacancy descriptions into markdown sections via Mistral AI
 * Run: node scripts/enrich-approved-jobs.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load env vars from .env.local
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
const MISTRAL_KEY = env.MISTRAL_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !MISTRAL_KEY) {
  console.error('Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MISTRAL_API_KEY')
  process.exit(1)
}

// Direct Supabase REST API (no SDK needed)
async function supabaseQuery(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Supabase GET error: ${res.status} ${await res.text()}`)
  return res.json()
}

async function supabaseUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Supabase PATCH error: ${res.status} ${await res.text()}`)
}

const SYSTEM_PROMPT = `Je bent een vacature content specialist. Je structureert ruwe vacatureteksten om naar professionele, scanbare markdown.

Genereer EXACT deze 4 secties in Markdown:

## Wat ga je doen?
[Beschrijf de dagelijkse werkzaamheden en verantwoordelijkheden. 100-150 woorden. Gebruik korte alinea's en bullet points waar nuttig.]

## Wie zoeken we?
[Beschrijf het profiel van de ideale kandidaat: ervaring, opleiding, vaardigheden. 80-120 woorden. Gebruik bullet points.]

## Wat bieden we?
[Beschrijf het aanbod: salaris, arbeidsvoorwaarden, doorgroeimogelijkheden, werksfeer. 80-120 woorden. Gebruik bullet points.]

## Over het bedrijf
[Korte beschrijving van het bedrijf, cultuur, missie. 60-100 woorden.]

Regels:
- Gebruik ALLEEN informatie uit de aangeleverde tekst
- Verzin NIETS bij — als informatie ontbreekt, sla die sectie dan compact samen
- Schrijf in professioneel Nederlands
- Output is pure Markdown (geen HTML)
- Elke sectie begint met ## heading
- Gebruik - voor bullet points, geen *
- Houd de toon professioneel maar toegankelijk
- Als de beschrijving in het Engels is, vertaal naar Nederlands`

async function enrichJob(job) {
  const userPrompt = `Vacaturetitel: ${job.title}
Bedrijf: ${job.company_name || 'Onbekend'}
Locatie: ${job.city || 'Onbekend'}
Salaris: ${job.salary || 'Niet vermeld'}
Dienstverband: ${job.employment || 'Niet vermeld'}

Ruwe vacaturetekst:
${(job.description || '').substring(0, 8000)}`

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_KEY}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Mistral API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function main() {
  console.log('Fetching approved jobs without enriched content...')

  // Fetch approved jobs with company name via two queries (REST API doesn't support joins easily)
  const jobs = await supabaseQuery('job_postings',
    'select=id,title,description,city,salary,employment,company_id&review_status=eq.approved&content_enriched_at=is.null&description=not.is.null&order=published_at.desc'
  )

  // Fetch company names for these jobs
  const companyIds = [...new Set(jobs.map(j => j.company_id).filter(Boolean))]
  const companies = companyIds.length > 0
    ? await supabaseQuery('companies', `select=id,name&id=in.(${companyIds.join(',')})`)
    : []
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]))

  console.log(`Found ${jobs.length} jobs to enrich`)

  let success = 0
  let failed = 0

  for (const job of jobs) {
    const companyName = companyMap[job.company_id] || 'Onbekend'
    process.stdout.write(`  Enriching: "${job.title}" (${companyName})... `)

    try {
      const markdown = await enrichJob({ ...job, company_name: companyName })

      if (!markdown || markdown.length < 100) {
        console.log('SKIP (output too short)')
        failed++
        continue
      }

      await supabaseUpdate('job_postings', job.id, {
        content_md: markdown,
        content_enriched_at: new Date().toISOString(),
      })
      console.log(`OK (${markdown.length} chars)`)
      success++

      // Rate limit: 500ms between calls
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${success} enriched, ${failed} failed, ${jobs.length} total`)
}

main()
