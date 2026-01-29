/**
 * Bulk fix script for Pipedrive organizations
 * Removes hoofddomein from subdomeinen where duplicates exist
 *
 * Usage:
 *   npx tsx scripts/fix-all-pipedrive-orgs.ts         # Scan only (dry run)
 *   npx tsx scripts/fix-all-pipedrive-orgs.ts --fix   # Actually fix the orgs
 */

import { createClient } from '@supabase/supabase-js';
import { pipedriveClient, HOOFDDOMEIN_OPTIONS, SUBDOMEIN_OPTIONS } from '../lib/pipedrive-client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HOOFDDOMEIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(HOOFDDOMEIN_OPTIONS).map(([name, id]) => [id, name])
);

const SUBDOMEIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(SUBDOMEIN_OPTIONS).map(([name, id]) => [id, name])
);

const HOOFDDOMEIN_FIELD_KEY = '7180a7123d1de658e8d1d642b8496802002ddc66';
const SUBDOMEIN_FIELD_KEY = '2a8e7ff62fa14d0c69b48fb025d0bdf80c04a28c';

interface OrgResult {
  pipedrive_id: number;
  name: string;
  hoofddomein: string;
  subdomeinen_before: string[];
  subdomeinen_after: string[];
  status: 'fixed' | 'already_correct' | 'no_hoofddomein' | 'error';
  error?: string;
}

async function checkAndFixOrg(pipedriveId: number, fix: boolean): Promise<OrgResult> {
  try {
    const org = await pipedriveClient.getOrganization(pipedriveId);

    if (!org) {
      return {
        pipedrive_id: pipedriveId,
        name: 'Unknown',
        hoofddomein: '',
        subdomeinen_before: [],
        subdomeinen_after: [],
        status: 'error',
        error: 'Organization not found in Pipedrive'
      };
    }

    const customFields = org.custom_fields || {};
    const hoofddomeinId = customFields[HOOFDDOMEIN_FIELD_KEY];
    const subdomeinIds: number[] = customFields[SUBDOMEIN_FIELD_KEY] || [];

    const hoofddomeinName = hoofddomeinId ? HOOFDDOMEIN_ID_TO_NAME[hoofddomeinId] : null;
    const subdomeinNames = Array.isArray(subdomeinIds)
      ? subdomeinIds.map((id: number) => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean)
      : [];

    if (!hoofddomeinName) {
      return {
        pipedrive_id: pipedriveId,
        name: org.name,
        hoofddomein: '',
        subdomeinen_before: subdomeinNames,
        subdomeinen_after: subdomeinNames,
        status: 'no_hoofddomein'
      };
    }

    // Check for duplicate
    if (!subdomeinNames.includes(hoofddomeinName)) {
      return {
        pipedrive_id: pipedriveId,
        name: org.name,
        hoofddomein: hoofddomeinName,
        subdomeinen_before: subdomeinNames,
        subdomeinen_after: subdomeinNames,
        status: 'already_correct'
      };
    }

    // Duplicate found!
    const hoofddomeinAsSubdomeinId = SUBDOMEIN_OPTIONS[hoofddomeinName];
    const newSubdomeinIds = subdomeinIds.filter((id: number) => id !== hoofddomeinAsSubdomeinId);
    const newSubdomeinNames = newSubdomeinIds.map((id: number) => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean);

    if (fix) {
      await pipedriveClient.updateOrganization(pipedriveId, {
        custom_fields: {
          [SUBDOMEIN_FIELD_KEY]: newSubdomeinIds.length > 0 ? newSubdomeinIds : null
        }
      });
    }

    return {
      pipedrive_id: pipedriveId,
      name: org.name,
      hoofddomein: hoofddomeinName,
      subdomeinen_before: subdomeinNames,
      subdomeinen_after: newSubdomeinNames,
      status: 'fixed'
    };
  } catch (error) {
    return {
      pipedrive_id: pipedriveId,
      name: 'Unknown',
      hoofddomein: '',
      subdomeinen_before: [],
      subdomeinen_after: [],
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function main() {
  const fix = process.argv.includes('--fix');

  console.log('='.repeat(60));
  console.log(fix ? '🔧 FIX MODE - Will update Pipedrive organizations' : '🔍 SCAN MODE - Dry run only (use --fix to apply changes)');
  console.log('='.repeat(60));
  console.log('');

  // Get all companies with pipedrive_id from database
  console.log('Fetching companies from database...');
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, pipedrive_id')
    .not('pipedrive_id', 'is', null)
    .order('pipedrive_synced_at', { ascending: false });

  if (error) {
    console.error('Error fetching companies:', error);
    process.exit(1);
  }

  console.log(`Found ${companies?.length || 0} companies with Pipedrive IDs\n`);

  const results: OrgResult[] = [];
  let processed = 0;

  for (const company of companies || []) {
    processed++;
    const pipedriveId = parseInt(company.pipedrive_id!);

    process.stdout.write(`\r[${processed}/${companies?.length}] Checking ${company.name.substring(0, 40).padEnd(40)}...`);

    const result = await checkAndFixOrg(pipedriveId, fix);
    results.push(result);

    // Rate limit: wait 300ms between requests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n\n');
  console.log('='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));

  // Summary
  const fixed = results.filter(r => r.status === 'fixed');
  const correct = results.filter(r => r.status === 'already_correct');
  const noHoofddomein = results.filter(r => r.status === 'no_hoofddomein');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\n📊 Summary:`);
  console.log(`   Total checked: ${results.length}`);
  console.log(`   ✅ Already correct: ${correct.length}`);
  console.log(`   🔧 ${fix ? 'Fixed' : 'Need fixing'}: ${fixed.length}`);
  console.log(`   ⚠️  No hoofddomein: ${noHoofddomein.length}`);
  console.log(`   ❌ Errors: ${errors.length}`);

  if (fixed.length > 0) {
    console.log(`\n${fix ? '🔧 Fixed organizations:' : '🔍 Organizations that need fixing:'}`);
    for (const org of fixed) {
      console.log(`   - ${org.name} (ID: ${org.pipedrive_id})`);
      console.log(`     Hoofddomein: ${org.hoofddomein}`);
      console.log(`     Before: [${org.subdomeinen_before.join(', ')}]`);
      console.log(`     After:  [${org.subdomeinen_after.join(', ')}]`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors:`);
    for (const org of errors) {
      console.log(`   - ID ${org.pipedrive_id}: ${org.error}`);
    }
  }

  if (!fix && fixed.length > 0) {
    console.log(`\n💡 Run with --fix flag to apply changes:`);
    console.log(`   npx tsx scripts/fix-all-pipedrive-orgs.ts --fix`);
  }
}

main().catch(console.error);
