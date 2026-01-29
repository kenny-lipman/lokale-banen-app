/**
 * Manual test script for postcode backfill service
 * Run with: npx tsx scripts/test-postcode-backfill.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { postcodeBackfillService } from '../lib/services/postcode-backfill.service';

async function test() {
  console.log('🧪 Starting manual test with batch of 3...\n');

  try {
    // First get stats
    console.log('📊 Current stats:');
    const stats = await postcodeBackfillService.getStats();
    console.log(JSON.stringify(stats, null, 2));
    console.log('\n');

    // Process small batch
    console.log('🔄 Processing batch of 3 companies...\n');
    const result = await postcodeBackfillService.processBatch(3);

    console.log('\n📊 Batch Results:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

test();
