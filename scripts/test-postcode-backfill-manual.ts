/**
 * Manual test script for postcode backfill service
 * Run with: npx tsx scripts/test-postcode-backfill-manual.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('Environment loaded:', {
  PIPEDRIVE_API_KEY: process.env.PIPEDRIVE_API_KEY ? '***' + process.env.PIPEDRIVE_API_KEY.slice(-4) : 'NOT SET',
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET',
})

async function main() {
  console.log('\n🧪 Testing Postcode Backfill Service\n')

  try {
    // Dynamic import AFTER env vars are loaded
    const { postcodeBackfillService } = await import('../lib/services/postcode-backfill.service')

    // Test 1: Get statistics
    console.log('📊 Test 1: Getting statistics...')
    const stats = await postcodeBackfillService.getStats()
    console.log('Stats:', JSON.stringify(stats, null, 2))

    // Test 2: Process mini batch (3 companies only)
    console.log('\n🔄 Test 2: Processing mini batch (3 companies)...')
    const result = await postcodeBackfillService.processBatch(3)
    console.log('Result:', JSON.stringify(result, null, 2))

    console.log('\n✅ All tests completed successfully!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
