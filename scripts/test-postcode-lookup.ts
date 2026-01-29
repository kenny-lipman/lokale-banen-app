/**
 * Test script for postcode-to-region lookup
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  // Dynamic import AFTER env vars are loaded
  const { InstantlyPipedriveSyncService } = await import('../lib/services/instantly-pipedrive-sync.service')
  const service = new InstantlyPipedriveSyncService()

  console.log('🧪 Testing postcode-to-region lookup with nearby search\n')

  const testCases = [
    { postcode: '5106', expected: 'OosterhoutseBanen', note: 'Dongen - between 5103 and 5121' },
    { postcode: '5126', expected: 'OosterhoutseBanen', note: 'Rijen - between 5122 and 5151' },
    { postcode: '4901', expected: 'OosterhoutseBanen', note: 'Oosterhout - exact match' },
    { postcode: '2991', expected: 'BarendrechtseBanen', note: 'Barendrecht - should be exact' },
  ]

  for (const test of testCases) {
    console.log(`Testing postcode ${test.postcode} (${test.note})...`)
    const result = await service.getRegioPlatformByPostalCode(test.postcode)
    const status = result === test.expected ? '✅' : '❌'
    console.log(`  ${status} Result: ${result || 'null'} (expected: ${test.expected})\n`)
  }
}

main().catch(console.error)
