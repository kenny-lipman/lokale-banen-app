/**
 * Script to get all Pipedrive field IDs
 * Run with: npx tsx scripts/get-pipedrive-fields.ts
 */

import 'dotenv/config';

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY;

async function getOrganizationFields() {
  console.log('📋 Organization Fields:\n');

  const response = await fetch(
    `https://api.pipedrive.com/v1/organizationFields?api_token=${PIPEDRIVE_API_KEY}`
  );
  const data = await response.json();

  if (data.data) {
    for (const field of data.data) {
      console.log(`- ${field.name}`);
      console.log(`  Key: ${field.key}`);
      console.log(`  Type: ${field.field_type}`);
      if (field.key.includes('address') || field.key.includes('website') || field.name.toLowerCase().includes('website')) {
        console.log(`  ⭐ RELEVANT FIELD`);
      }
      console.log('');
    }
  }
}

async function getPersonFields() {
  console.log('\n📋 Person Fields (ALL):\n');

  const response = await fetch(
    `https://api.pipedrive.com/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`
  );
  const data = await response.json();

  if (data.data) {
    for (const field of data.data) {
      console.log(`- ${field.name}`);
      console.log(`  Key: ${field.key}`);
      console.log(`  Type: ${field.field_type}`);
      console.log('');
    }
  }
}

async function createFunctieField() {
  console.log('\n🔧 Creating "Functie" field for Person...\n');

  const response = await fetch(
    `https://api.pipedrive.com/v1/personFields?api_token=${PIPEDRIVE_API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Functie',
        field_type: 'varchar'
      })
    }
  );

  const data = await response.json();

  if (data.success) {
    console.log('✅ Created "Functie" field successfully!');
    console.log(`   Field ID: ${data.data.key}`);
    console.log(`   Field Name: ${data.data.name}`);
    console.log(`   Field Type: ${data.data.field_type}`);
  } else {
    console.log('❌ Failed to create field:');
    console.log(data);
  }
}

async function findEnrichedContacts() {
  // Import supabase client dynamically
  const { createClient } = await import('@supabase/supabase-js');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('\n🔍 Finding contacts with enrichment data...\n');

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      email,
      first_name,
      last_name,
      title,
      companies (
        name,
        website,
        city,
        street_address,
        postal_code
      )
    `)
    .not('email', 'is', null)
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter for contacts with enrichment data
  const enriched = data?.filter((c: any) => {
    const company = c.companies as any;
    return company?.website || company?.city || c.title;
  });

  if (!enriched || enriched.length === 0) {
    console.log('No enriched contacts found');
    return;
  }

  console.log(`Found ${enriched.length} contacts with enrichment data:\n`);
  for (const contact of enriched.slice(0, 5)) {
    const company = contact.companies as any;
    console.log(`📧 ${contact.email}`);
    console.log(`   Name: ${contact.first_name || ''} ${contact.last_name || ''}`);
    console.log(`   Title: ${contact.title || '(none)'}`);
    console.log(`   Company: ${company?.name || '(none)'}`);
    console.log(`   Website: ${company?.website || '(none)'}`);
    console.log(`   City: ${company?.city || '(none)'}`);
    console.log(`   Address: ${company?.street_address || '(none)'}`);
    console.log(`   Postal: ${company?.postal_code || '(none)'}`);
    console.log('');
  }
}

async function main() {
  if (!PIPEDRIVE_API_KEY) {
    console.error('PIPEDRIVE_API_KEY not set');
    return;
  }

  const args = process.argv.slice(2);

  if (args.includes('--create-functie')) {
    await createFunctieField();
  } else if (args.includes('--find-enriched')) {
    await findEnrichedContacts();
  } else {
    await getOrganizationFields();
    await getPersonFields();
    console.log('\n💡 Options:');
    console.log('   --create-functie: Create the "Functie" field in Pipedrive');
    console.log('   --find-enriched: Find contacts with enrichment data');
  }
}

main().catch(console.error);
