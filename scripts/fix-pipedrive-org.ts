import { pipedriveClient, HOOFDDOMEIN_OPTIONS, SUBDOMEIN_OPTIONS } from '../lib/pipedrive-client';

const HOOFDDOMEIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(HOOFDDOMEIN_OPTIONS).map(([name, id]) => [id, name])
);

const SUBDOMEIN_ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(SUBDOMEIN_OPTIONS).map(([name, id]) => [id, name])
);

const HOOFDDOMEIN_FIELD_KEY = '7180a7123d1de658e8d1d642b8496802002ddc66';
const SUBDOMEIN_FIELD_KEY = '2a8e7ff62fa14d0c69b48fb025d0bdf80c04a28c';

async function fixOrg(orgId: number) {
  console.log('Fetching org', orgId);
  const org = await pipedriveClient.getOrganization(orgId);

  console.log('Org name:', org.name);

  // Custom fields are nested under custom_fields object
  const customFields = org.custom_fields || {};
  const hoofddomeinId = customFields[HOOFDDOMEIN_FIELD_KEY];
  const subdomeinIds = customFields[SUBDOMEIN_FIELD_KEY] || [];

  const hoofddomeinName = hoofddomeinId ? HOOFDDOMEIN_ID_TO_NAME[hoofddomeinId] : null;
  const subdomeinNames = Array.isArray(subdomeinIds)
    ? subdomeinIds.map((id: number) => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean)
    : [];

  console.log('Hoofddomein:', hoofddomeinName, '(ID:', hoofddomeinId, ')');
  console.log('Subdomeinen:', subdomeinNames, '(IDs:', subdomeinIds, ')');

  if (hoofddomeinName && subdomeinNames.includes(hoofddomeinName)) {
    console.log('DUPLICATE FOUND! Fixing...');

    const hoofddomeinAsSubdomeinId = SUBDOMEIN_OPTIONS[hoofddomeinName];
    const newSubdomeinIds = subdomeinIds.filter((id: number) => id !== hoofddomeinAsSubdomeinId);
    const newSubdomeinNames = newSubdomeinIds.map((id: number) => SUBDOMEIN_ID_TO_NAME[id]).filter(Boolean);

    console.log('New subdomeinen:', newSubdomeinNames, '(IDs:', newSubdomeinIds, ')');

    await pipedriveClient.updateOrganization(orgId, {
      custom_fields: {
        [SUBDOMEIN_FIELD_KEY]: newSubdomeinIds.length > 0 ? newSubdomeinIds : null
      }
    });

    console.log('✅ Fixed! Removed', hoofddomeinName, 'from subdomeinen');
  } else {
    console.log('No duplicate found, org is already correct');
  }
}

// Get org ID from command line argument
const orgId = parseInt(process.argv[2] || '40269');
fixOrg(orgId).catch(console.error);
