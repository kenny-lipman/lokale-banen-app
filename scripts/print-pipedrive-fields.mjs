// scripts/print-pipedrive-fields.mjs
import 'dotenv/config'

const API_KEY = process.env.PIPEDRIVE_API_KEY
const BASE = 'https://lokalebanen.pipedrive.com/api/v1'
if (!API_KEY) {
  console.error('Set PIPEDRIVE_API_KEY in .env')
  process.exit(1)
}

async function fetchFields(endpoint) {
  const res = await fetch(`${BASE}${endpoint}?api_token=${API_KEY}`)
  const json = await res.json()
  if (!json.success) throw new Error(`${endpoint}: ${json.error}`)
  return json.data
}

function printTable(name, fields) {
  console.log(`\n=== ${name} ===`)
  for (const f of fields) {
    if (!f.add_visible_flag && !f.edit_flag) continue
    if (['name', 'email', 'phone', 'address', 'value', 'currency', 'title', 'org_id', 'person_id', 'pipeline_id', 'stage_id', 'owner_id'].includes(f.key)) continue
    const opts = f.options ? ` opts=[${f.options.slice(0, 6).map((o) => `${o.id}=${o.label}`).join(', ')}${f.options.length > 6 ? '…' : ''}]` : ''
    console.log(`  ${f.key.padEnd(42)} ${f.field_type.padEnd(12)} ${f.name}${opts}`)
  }
}

const orgFields = await fetchFields('/organizationFields')
printTable('Organization fields', orgFields)
const personFields = await fetchFields('/personFields')
printTable('Person fields', personFields)
const dealFields = await fetchFields('/dealFields')
printTable('Deal fields', dealFields)
