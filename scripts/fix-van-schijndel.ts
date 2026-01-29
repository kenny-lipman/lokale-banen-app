/**
 * Fix Van Schijndel Metaal Pipedrive org with correct hoofddomein
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const { PostcodeBackfillService } = await import('../lib/services/postcode-backfill.service')
  const service = new PostcodeBackfillService()

  console.log('Fixing Pipedrive org 40216 (Van Schijndel Metaal) with postcode 5106...')

  const result = await service.fixPipedriveHoofddomein(
    'ef2de6fa-238d-49f2-840e-474269183f5f', // company ID
    40216,  // Pipedrive org ID
    '5106'  // Postcode
  )

  console.log('Result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
