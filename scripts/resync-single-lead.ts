/**
 * Resync a single lead to test the fix
 * Run with: npx tsx scripts/resync-single-lead.ts
 */

import 'dotenv/config';
import { instantlyPipedriveSyncService } from '../lib/services/instantly-pipedrive-sync.service';
import { createServiceRoleClient } from '../lib/supabase-server';

const TARGET_EMAIL = 'info@infraconnection.nl';
const TARGET_CAMPAIGN_ID = '3f3bb51c-1166-4325-b101-62fe7c0c1535';
const TARGET_CAMPAIGN_NAME = 'ZoetermeerseBanen';

async function main() {
  const supabase = createServiceRoleClient();

  console.log(`\n🔄 Re-syncing ${TARGET_EMAIL}...\n`);

  // Check current state before
  const { data: beforeContact } = await supabase
    .from('contacts')
    .select('qualification_status, instantly_campaign_ids, instantly_synced')
    .eq('email', TARGET_EMAIL)
    .single();

  console.log('📋 Before sync:');
  console.log(`   qualification_status: ${beforeContact?.qualification_status}`);
  console.log(`   instantly_campaign_ids: ${JSON.stringify(beforeContact?.instantly_campaign_ids)}`);
  console.log(`   instantly_synced: ${beforeContact?.instantly_synced}`);

  // Force resync
  const result = await instantlyPipedriveSyncService.syncLeadToPipedrive(
    {
      email: TARGET_EMAIL,
      firstName: 'Afdeling personeelszaken',
      companyName: 'infraconnection',
      replyCount: 0
    },
    TARGET_CAMPAIGN_ID,
    TARGET_CAMPAIGN_NAME,
    'backfill',
    'backfill',
    {
      hasReply: false,
      force: true // Force re-sync
    }
  );

  console.log('\n📊 Sync Result:');
  console.log(`   Success: ${result.success}`);
  console.log(`   Skipped: ${result.skipped} ${result.skipReason ? `(${result.skipReason})` : ''}`);
  console.log(`   Pipedrive Org: ${result.pipedriveOrgId}`);
  console.log(`   Pipedrive Person: ${result.pipedrivePersonId}`);
  console.log(`   Status Set: ${result.statusSet}`);

  // Check state after
  const { data: afterContact } = await supabase
    .from('contacts')
    .select('qualification_status, instantly_campaign_ids, instantly_synced, last_touch')
    .eq('email', TARGET_EMAIL)
    .single();

  console.log('\n📋 After sync:');
  console.log(`   qualification_status: ${afterContact?.qualification_status}`);
  console.log(`   instantly_campaign_ids: ${JSON.stringify(afterContact?.instantly_campaign_ids)}`);
  console.log(`   instantly_synced: ${afterContact?.instantly_synced}`);
  console.log(`   last_touch: ${afterContact?.last_touch}`);

  // Verify the fix
  if (afterContact?.qualification_status === 'in_campaign') {
    console.log('\n✅ FIX VERIFIED: qualification_status is now "in_campaign"!');
  } else {
    console.log('\n❌ FIX NOT WORKING: qualification_status is still not "in_campaign"');
  }
}

main().catch(console.error);
