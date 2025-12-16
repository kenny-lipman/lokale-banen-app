/**
 * Test script for backfilling 1 lead from Instantly to Pipedrive
 * Run with: npx tsx scripts/test-backfill.ts
 */

import 'dotenv/config';
import { instantlyClient } from '../lib/instantly-client';
import { instantlyPipedriveSyncService } from '../lib/services/instantly-pipedrive-sync.service';

async function main() {
  console.log('🔍 Fetching campaigns from Instantly...');

  const campaigns = await instantlyClient.listCampaigns();
  console.log(`Found ${campaigns.length} campaigns\n`);

  // Get first campaign with leads
  let foundLead = null;
  let foundCampaign = null;

  for (const campaign of campaigns) {
    console.log(`\n🔍 Checking campaign: ${campaign.name}...`);

    const response = await instantlyClient.listLeads({
      campaign_id: campaign.id,
      limit: 1
    });

    if (response.items && response.items.length > 0) {
      foundLead = response.items[0];
      foundCampaign = campaign;
      console.log(`✅ Found lead!`);
      break;
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  if (!foundLead || !foundCampaign) {
    console.log('\n❌ No leads found');
    return;
  }

  const lead = foundLead;
  const campaign = foundCampaign;

  console.log(`\n📧 Using campaign: ${campaign.name} (${campaign.id})`);
  console.log(`\n👤 Testing with lead: ${lead.email}`);
  console.log(`   - First name: ${lead.first_name || '(none)'}`);
  console.log(`   - Last name: ${lead.last_name || '(none)'}`);
  console.log(`   - Company: ${lead.company_name || '(none)'}`);
  console.log(`   - Status: ${lead.status}`);
  console.log(`   - Reply count: ${lead.email_reply_count || 0}`);

  // Now run the actual sync
  console.log('\n🚀 Running sync to Pipedrive...');
  const result = await instantlyPipedriveSyncService.syncLeadToPipedrive(
    {
      email: lead.email,
      firstName: lead.first_name,
      lastName: lead.last_name,
      companyName: lead.company_name,
      replyCount: lead.email_reply_count || 0
    },
    campaign.id,
    campaign.name,
    'backfill',
    'backfill',
    {
      hasReply: (lead.email_reply_count || 0) > 0,
      force: true
    }
  );

  console.log('\n✅ Sync result:');
  console.log(`   - Success: ${result.success}`);
  console.log(`   - Pipedrive Org ID: ${result.pipedriveOrgId}`);
  console.log(`   - Pipedrive Org Name: ${result.pipedriveOrgName}`);
  console.log(`   - Pipedrive Person ID: ${result.pipedrivePersonId}`);
  console.log(`   - Status Set: ${result.statusSet}`);
  if (result.error) {
    console.log(`   - Error: ${result.error}`);
  }

  console.log('\n🎉 Check Pipedrive for the organization note and email activities!');
}

main().catch(console.error);
