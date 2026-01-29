/**
 * Fix script: Correct the 46 backfill syncs that were incorrectly labeled as "ZwolseBanen"
 *
 * Due to a bug in the Instantly API parameter names (campaign_id vs campaign),
 * the campaign filter wasn't working. All 46 leads were fetched from ALL campaigns
 * but labeled as "ZwolseBanen".
 *
 * This script:
 * 1. Gets all affected sync records from our DB
 * 2. For each email, queries Instantly (with fixed API) to find the REAL campaign
 * 3. Updates Pipedrive notes to reflect the correct campaign
 * 4. Updates our DB sync records
 *
 * Run: npx tsx scripts/fix-zwolsebanen-syncs.ts [--dry-run]
 */

import { instantlyClient } from '../lib/instantly-client';
import { pipedriveClient } from '../lib/pipedrive-client';
import { createServiceRoleClient } from '../lib/supabase-server';

const DRY_RUN = process.argv.includes('--dry-run');

interface AffectedSync {
  id: string;
  instantly_lead_email: string;
  instantly_campaign_id: string;
  instantly_campaign_name: string;
  pipedrive_org_id: number;
  pipedrive_org_name: string;
  pipedrive_person_id: number;
}

async function main() {
  console.log(`\n🔧 Fix ZwolseBanen Sync Records ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}\n`);

  const supabase = createServiceRoleClient();

  // 1. Get all affected sync records
  console.log('📋 Ophalen van foutieve sync records...');
  const { data: affectedSyncs, error } = await supabase
    .from('instantly_pipedrive_syncs')
    .select('id, instantly_lead_email, instantly_campaign_id, instantly_campaign_name, pipedrive_org_id, pipedrive_org_name, pipedrive_person_id')
    .eq('instantly_campaign_name', 'ZwolseBanen')
    .eq('event_type', 'backfill')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ DB error:', error);
    return;
  }

  console.log(`  Gevonden: ${affectedSyncs.length} foutieve syncs\n`);

  // 2. Get all campaigns from Instantly (for mapping)
  console.log('📧 Ophalen van Instantly campagnes...');
  const campaigns = await instantlyClient.listCampaigns();
  console.log(`  Gevonden: ${campaigns.length} campagnes\n`);

  // Build campaign ID -> name map
  const campaignIdToName = new Map<string, string>();
  for (const c of campaigns) {
    campaignIdToName.set(c.id, c.name);
  }

  // 3. For each email, find the REAL campaign
  console.log('🔍 Zoeken naar echte campagnes per lead...\n');

  const emailToCampaign = new Map<string, { campaignId: string; campaignName: string } | null>();
  const uniqueEmails = [...new Set(affectedSyncs.map(s => s.instantly_lead_email))];

  for (const email of uniqueEmails) {
    // Search globally (no campaign filter) to find which campaign the lead is actually in
    const results = await instantlyClient.listLeads({
      email: email,
      limit: 10,
    });

    if (results.items.length > 0) {
      const lead = results.items[0];
      // The lead response should include campaign info
      const leadCampaignId = (lead as any).campaign_id || (lead as any).campaign;
      const campaignName = leadCampaignId ? campaignIdToName.get(leadCampaignId) : null;

      if (campaignName && campaignName !== 'ZwolseBanen') {
        emailToCampaign.set(email, { campaignId: leadCampaignId, campaignName });
        console.log(`  ✅ ${email} → ${campaignName}`);
      } else if (campaignName === 'ZwolseBanen') {
        // Actually in ZwolseBanen — no fix needed
        emailToCampaign.set(email, null);
        console.log(`  ℹ️ ${email} → ZwolseBanen (was al correct)`);
      } else {
        // Try searching in each campaign one by one
        let found = false;
        for (const campaign of campaigns) {
          if (campaign.name === 'ZwolseBanen') continue;

          try {
            const campaignResults = await instantlyClient.listLeads({
              campaign_id: campaign.id,
              email: email,
              limit: 1,
            });

            if (campaignResults.items.length > 0) {
              emailToCampaign.set(email, { campaignId: campaign.id, campaignName: campaign.name });
              console.log(`  ✅ ${email} → ${campaign.name} (via campaign search)`);
              found = true;
              break;
            }
          } catch (e) {
            // Rate limit or error, continue
          }

          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 200));
        }

        if (!found) {
          emailToCampaign.set(email, null);
          console.log(`  ⚠️ ${email} → niet gevonden in specifieke campagne`);
        }
      }
    } else {
      emailToCampaign.set(email, null);
      console.log(`  ⚠️ ${email} → niet gevonden in Instantly`);
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 300));
  }

  // 4. Summary of findings
  const needsFixing = [...emailToCampaign.entries()].filter(([_, v]) => v !== null);
  const noFixNeeded = [...emailToCampaign.entries()].filter(([_, v]) => v === null);

  console.log(`\n📊 Samenvatting:`);
  console.log(`  Te fixen: ${needsFixing.length} emails`);
  console.log(`  Geen fix nodig: ${noFixNeeded.length} emails\n`);

  if (needsFixing.length === 0) {
    console.log('✅ Geen notities om te fixen!');
    return;
  }

  // 5. Fix Pipedrive notes
  console.log('📝 Pipedrive notities updaten...\n');

  const processedOrgs = new Set<number>();
  let notesUpdated = 0;
  let notesNotFound = 0;
  let dbRecordsUpdated = 0;

  for (const sync of affectedSyncs) {
    const realCampaign = emailToCampaign.get(sync.instantly_lead_email);
    if (!realCampaign) continue;

    // Update Pipedrive notes (once per org)
    if (!processedOrgs.has(sync.pipedrive_org_id)) {
      processedOrgs.add(sync.pipedrive_org_id);

      try {
        // Get all notes for this org
        const notes = await pipedriveClient.listOrganizationNotes(sync.pipedrive_org_id);

        // Find notes containing "Campagne: ZwolseBanen"
        const wrongNotes = notes.filter((n: any) =>
          n.content && n.content.includes('Campagne: ZwolseBanen')
        );

        if (wrongNotes.length > 0) {
          for (const note of wrongNotes) {
            const newContent = note.content.replace(
              'Campagne: ZwolseBanen',
              `Campagne: ${realCampaign.campaignName}`
            );

            if (!DRY_RUN) {
              await pipedriveClient.updateNote(note.id, newContent);
            }

            notesUpdated++;
            console.log(`  ✏️ Org ${sync.pipedrive_org_name} (${sync.pipedrive_org_id}): note ${note.id} → "${realCampaign.campaignName}" ${DRY_RUN ? '(dry run)' : ''}`);
          }
        } else {
          notesNotFound++;
          console.log(`  ⚠️ Org ${sync.pipedrive_org_name} (${sync.pipedrive_org_id}): geen ZwolseBanen note gevonden`);
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`  ❌ Org ${sync.pipedrive_org_name}: error`, err);
      }
    }

    // 6. Update DB sync record
    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('instantly_pipedrive_syncs')
        .update({
          instantly_campaign_name: realCampaign.campaignName,
          // Note: instantly_campaign_id stays the same (it was the ZwolseBanen campaign ID)
          // but we add the correct campaign name
        })
        .eq('id', sync.id);

      if (updateError) {
        console.error(`  ❌ DB update error for ${sync.id}:`, updateError);
      } else {
        dbRecordsUpdated++;
      }
    } else {
      dbRecordsUpdated++;
    }
  }

  console.log(`\n✅ Klaar!`);
  console.log(`  Pipedrive notities updated: ${notesUpdated}`);
  console.log(`  Notities niet gevonden: ${notesNotFound}`);
  console.log(`  DB records updated: ${dbRecordsUpdated}`);
  if (DRY_RUN) {
    console.log(`\n⚠️ Dit was een DRY RUN. Voer opnieuw uit zonder --dry-run voor echte wijzigingen.`);
  }
}

main().catch(console.error);
