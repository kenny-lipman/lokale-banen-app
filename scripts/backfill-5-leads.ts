/**
 * Backfill script for syncing 5 leads from a specific Instantly campaign to Pipedrive
 * Run with: npx tsx scripts/backfill-5-leads.ts
 */

import 'dotenv/config';
import { instantlyClient } from '../lib/instantly-client';
import { instantlyPipedriveSyncService } from '../lib/services/instantly-pipedrive-sync.service';

// Target campaign from https://app.instantly.ai/app/campaign/3f3bb51c-1166-4325-b101-62fe7c0c1535/analytics
const TARGET_CAMPAIGN_ID = '3f3bb51c-1166-4325-b101-62fe7c0c1535';

async function main() {
  console.log('🔍 Fetching campaign info from Instantly...');
  console.log(`Campaign ID: ${TARGET_CAMPAIGN_ID}\n`);

  // Get campaign details
  const campaign = await instantlyClient.getCampaign(TARGET_CAMPAIGN_ID);

  if (!campaign) {
    console.error('❌ Campaign not found!');
    process.exit(1);
  }

  console.log(`📧 Campaign: ${campaign.name}`);
  console.log(`   Status: ${campaign.status}\n`);

  // Fetch leads from this specific campaign
  console.log('🔍 Fetching leads from campaign...');
  const leads = await instantlyClient.listLeadsByCampaign(TARGET_CAMPAIGN_ID);

  console.log(`Found ${leads.length} leads in campaign\n`);

  // Take first 5 leads
  const leadsToSync = leads.slice(0, 5);

  console.log(`📋 Syncing ${leadsToSync.length} leads to Pipedrive...\n`);
  console.log('='.repeat(60));

  const results: any[] = [];

  for (let i = 0; i < leadsToSync.length; i++) {
    const lead = leadsToSync[i];

    console.log(`\n--- [${i + 1}/${leadsToSync.length}] ${lead.email} ---`);
    console.log(`   First Name: ${lead.first_name || '(none)'}`);
    console.log(`   Last Name: ${lead.last_name || '(none)'}`);
    console.log(`   Company: ${lead.company_name || '(none)'}`);
    console.log(`   Reply Count: ${lead.email_reply_count || 0}`);
    console.log(`   Interest Status: ${lead.interest_status || '(none)'}`);
    console.log(`   Lead Status: ${lead.status}`);

    // Determine if has reply
    const hasReply = (lead.email_reply_count || 0) > 0;

    // Determine reply sentiment based on interest_status
    let replySentiment: 'positive' | 'negative' | 'neutral' | undefined;
    if (lead.interest_status === 1) {
      replySentiment = 'positive';
    } else if (lead.interest_status === -1) {
      replySentiment = 'negative';
    } else if (hasReply) {
      replySentiment = 'neutral';
    }

    // Determine event type
    let eventType: 'backfill' | 'lead_interested' | 'lead_not_interested' | 'reply_received' = 'backfill';
    if (lead.interest_status === 1) {
      eventType = 'lead_interested';
    } else if (lead.interest_status === -1) {
      eventType = 'lead_not_interested';
    } else if (hasReply) {
      eventType = 'reply_received';
    }

    console.log(`   → Event Type: ${eventType}`);
    console.log(`   → Has Reply: ${hasReply}`);
    console.log(`   → Sentiment: ${replySentiment || 'N/A'}`);

    try {
      const result = await instantlyPipedriveSyncService.syncLeadToPipedrive(
        {
          email: lead.email,
          firstName: lead.first_name,
          lastName: lead.last_name,
          companyName: lead.company_name,
          replyCount: lead.email_reply_count || 0
        },
        TARGET_CAMPAIGN_ID,
        campaign.name,
        eventType,
        'backfill',
        {
          hasReply,
          replySentiment,
          force: false
        }
      );

      results.push({ lead, result });

      if (result.success) {
        console.log(`\n   ✅ SUCCESS`);
        console.log(`      Pipedrive Org ID: ${result.pipedriveOrgId || 'N/A (freemail)'}`);
        console.log(`      Pipedrive Org Name: ${result.pipedriveOrgName || 'N/A'}`);
        console.log(`      Pipedrive Person ID: ${result.pipedrivePersonId}`);
        console.log(`      Org Created: ${result.orgCreated}`);
        console.log(`      Person Created: ${result.personCreated}`);
        console.log(`      Status Set: ${result.statusSet || 'N/A'}`);
        console.log(`      Email Activities: ${result.emailActivitiesCount || 0} synced`);
      } else if (result.skipped) {
        console.log(`\n   ⏭️ SKIPPED: ${result.skipReason}`);
      } else {
        console.log(`\n   ❌ FAILED: ${result.error}`);
      }
    } catch (error) {
      console.log(`\n   ❌ ERROR: ${error instanceof Error ? error.message : error}`);
      results.push({ lead, result: { success: false, error: String(error) } });
    }

    // Rate limit between syncs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.result.success).length;
  const skipped = results.filter(r => r.result.skipped).length;
  const failed = results.filter(r => !r.result.success && !r.result.skipped).length;

  console.log(`\n   Total leads processed: ${results.length}`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ⏭️ Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);

  console.log('\n📝 Detailed Results:');
  for (const { lead, result } of results) {
    const status = result.success ? '✅' : result.skipped ? '⏭️' : '❌';
    const info = result.success
      ? `Org: ${result.pipedriveOrgId || 'N/A'}, Person: ${result.pipedrivePersonId}`
      : result.skipped
        ? result.skipReason
        : result.error;
    console.log(`   ${status} ${lead.email}: ${info}`);
  }

  console.log('\n🎉 Backfill complete!');
}

main().catch(console.error);
