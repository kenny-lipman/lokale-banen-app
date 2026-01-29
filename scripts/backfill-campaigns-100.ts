/**
 * One-time backfill script: Sync 100 leads per campaign to Pipedrive
 *
 * Target campaigns:
 * - 95c95709-ac7c-4152-929b-15c02bcf879e
 * - bc7b9f71-604b-4ce6-acf1-8e6e5a1e013f
 *
 * Run with: npx tsx scripts/backfill-campaigns-100.ts
 * Dry run:  npx tsx scripts/backfill-campaigns-100.ts --dry-run
 */

import 'dotenv/config';
import { instantlyPipedriveSyncService } from '../lib/services/instantly-pipedrive-sync.service';

const CAMPAIGN_IDS = [
  '95c95709-ac7c-4152-929b-15c02bcf879e',
  'bc7b9f71-604b-4ce6-acf1-8e6e5a1e013f',
];

const MAX_LEADS_PER_CAMPAIGN = 100;
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('='.repeat(60));
  console.log('🔄 Backfill: 100 leads per campaign → Pipedrive');
  console.log(`   Mode: ${DRY_RUN ? '🧪 DRY RUN (no actual sync)' : '🚀 LIVE'}`);
  console.log(`   Campaigns: ${CAMPAIGN_IDS.length}`);
  console.log(`   Max leads per campaign: ${MAX_LEADS_PER_CAMPAIGN}`);
  console.log('='.repeat(60));

  const overallResults = {
    campaigns: 0,
    totalLeads: 0,
    synced: 0,
    skipped: 0,
    errors: 0,
  };

  for (const campaignId of CAMPAIGN_IDS) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📧 Campaign: ${campaignId}`);
    console.log('─'.repeat(60));

    try {
      const result = await instantlyPipedriveSyncService.backfillCampaign(campaignId, {
        dryRun: DRY_RUN,
        batchSize: 25,
        skipExisting: true,
        maxLeads: MAX_LEADS_PER_CAMPAIGN,
      });

      overallResults.campaigns++;
      overallResults.totalLeads += result.total;
      overallResults.synced += result.synced;
      overallResults.skipped += result.skipped;
      overallResults.errors += result.errors;

      console.log(`\n📊 Campaign result: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors (${result.total} total)`);
    } catch (error) {
      console.error(`\n❌ Campaign failed: ${error instanceof Error ? error.message : error}`);
      overallResults.campaigns++;
    }

    // Pause between campaigns
    if (CAMPAIGN_IDS.indexOf(campaignId) < CAMPAIGN_IDS.length - 1) {
      console.log('\n⏳ Pausing 5 seconds before next campaign...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Campaigns processed: ${overallResults.campaigns}`);
  console.log(`   Total leads:         ${overallResults.totalLeads}`);
  console.log(`   ✅ Synced:           ${overallResults.synced}`);
  console.log(`   ⏭️ Skipped:          ${overallResults.skipped}`);
  console.log(`   ❌ Errors:           ${overallResults.errors}`);
  console.log('='.repeat(60));
  console.log('\n🎉 Backfill complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
