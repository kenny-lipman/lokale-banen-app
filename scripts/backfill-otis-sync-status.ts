/**
 * Backfill script to update contacts/companies tables with existing sync data
 * This connects the instantly_pipedrive_syncs table to the main contacts/companies tables
 * Run with: npx tsx scripts/backfill-otis-sync-status.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function backfillOtisSyncStatus() {
  console.log('🔄 Starting Otis sync status backfill...\n');

  // Get all successful syncs from instantly_pipedrive_syncs
  const { data: syncs, error: syncError } = await supabase
    .from('instantly_pipedrive_syncs')
    .select('*')
    .eq('sync_success', true)
    .order('synced_at', { ascending: false });

  if (syncError || !syncs) {
    console.error('Error fetching syncs:', syncError);
    return;
  }

  console.log(`📊 Found ${syncs.length} successful syncs to process\n`);

  let contactsUpdated = 0;
  let companiesUpdated = 0;
  let contactsNotFound = 0;
  let companiesNotFound = 0;

  for (const sync of syncs) {
    const email = sync.instantly_lead_email?.toLowerCase().trim();
    if (!email) continue;

    // === UPDATE CONTACT ===
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, instantly_campaign_ids')
      .eq('email', email)
      .single();

    if (contact) {
      // Build campaign IDs array
      let campaignIds = contact.instantly_campaign_ids || [];
      if (sync.instantly_campaign_id && !campaignIds.includes(sync.instantly_campaign_id)) {
        campaignIds = [...campaignIds, sync.instantly_campaign_id];
      }

      const updateData: any = {
        instantly_synced: true,
        instantly_synced_at: sync.synced_at,
        instantly_status: sync.event_type,
        instantly_campaign_ids: campaignIds
      };

      if (sync.pipedrive_person_id) {
        updateData.pipedrive_person_id = sync.pipedrive_person_id.toString();
        updateData.pipedrive_synced = true;
        updateData.pipedrive_synced_at = sync.synced_at;
      }

      const { error: contactError } = await supabase
        .from('contacts')
        .update(updateData)
        .eq('id', contact.id);

      if (!contactError) {
        contactsUpdated++;
        console.log(`✅ Contact: ${email}`);
      }
    } else {
      contactsNotFound++;
    }

    // === UPDATE COMPANY ===
    if (sync.pipedrive_org_id) {
      const emailDomain = email.split('@')[1];

      // Try to find company via contact's company_id
      let companyId: string | null = null;

      if (contact) {
        const { data: contactWithCompany } = await supabase
          .from('contacts')
          .select('company_id')
          .eq('email', email)
          .single();

        companyId = contactWithCompany?.company_id || null;
      }

      // If no company via contact, try website domain
      if (!companyId && emailDomain) {
        const { data: companyByDomain } = await supabase
          .from('companies')
          .select('id')
          .or(`website.ilike.%${emailDomain}%`)
          .limit(1)
          .single();

        companyId = companyByDomain?.id || null;
      }

      // If still no company, try name match
      if (!companyId && sync.pipedrive_org_name) {
        const { data: companyByName } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', `%${sync.pipedrive_org_name}%`)
          .limit(1)
          .single();

        companyId = companyByName?.id || null;
      }

      if (companyId) {
        const { error: companyError } = await supabase
          .from('companies')
          .update({
            pipedrive_id: sync.pipedrive_org_id.toString(),
            pipedrive_synced: true,
            pipedrive_synced_at: sync.synced_at
          })
          .eq('id', companyId);

        if (!companyError) {
          companiesUpdated++;
          console.log(`✅ Company: ${sync.pipedrive_org_name || emailDomain}`);
        }
      } else {
        companiesNotFound++;
      }
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n📊 Backfill Summary:');
  console.log(`   Contacts updated: ${contactsUpdated}`);
  console.log(`   Contacts not found: ${contactsNotFound}`);
  console.log(`   Companies updated: ${companiesUpdated}`);
  console.log(`   Companies not found: ${companiesNotFound}`);
  console.log('\n✅ Backfill complete!');
}

backfillOtisSyncStatus().catch(console.error);
