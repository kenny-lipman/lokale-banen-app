import { getPipedriveClient } from '../apps/admin/lib/pipedrive-client'

/**
 * Read-only inspectie van de Pipedrive V2 API om de respons-vormen te bevestigen
 * die de sales-lead sync gebruikt:
 *   - getOrganizationV2(orgId): bevestigt de `custom_fields`-wrapper + de
 *     waarde-vorm per veldtype (gebruikt door fillEmptyOrgFields).
 *   - searchPersonByEmail(email): bevestigt de item-vorm (emails / primary_email /
 *     organization) die findExistingPersonByEmail nodig heeft voor exacte match
 *     en org-koppeling.
 *
 * Maakt NIETS aan; alleen GET-calls. Vereist PIPEDRIVE_API_KEY in de env.
 *
 * Gebruik:
 *   npx tsx scripts/inspect-pipedrive-org-v2.ts <orgId> [email]
 */
async function main() {
  const orgId = parseInt(process.argv[2] || '', 10)
  const email = process.argv[3]

  if (!Number.isFinite(orgId)) {
    console.error('Gebruik: npx tsx scripts/inspect-pipedrive-org-v2.ts <orgId> [email]')
    process.exit(1)
  }

  const pd = getPipedriveClient()

  console.log(`\n=== getOrganizationV2(${orgId}) ===`)
  const org = await pd.getOrganizationV2(orgId)
  console.log(JSON.stringify(org, null, 2))
  console.log('\n--- custom_fields keys + waarde-types ---')
  const cf = (org as { custom_fields?: Record<string, unknown> }).custom_fields ?? {}
  for (const [key, value] of Object.entries(cf)) {
    console.log(`${key}: ${Array.isArray(value) ? 'array' : typeof value} =`, JSON.stringify(value))
  }

  if (email) {
    console.log(`\n=== searchPersonByEmail(${email}) ===`)
    const items = await pd.searchPersonByEmail(email)
    console.log(JSON.stringify(items, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
