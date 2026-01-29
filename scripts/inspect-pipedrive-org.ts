import { pipedriveClient } from '../lib/pipedrive-client';

async function inspectOrg(orgId: number) {
  console.log('Fetching org', orgId);
  const org = await pipedriveClient.getOrganization(orgId);

  console.log('\n=== Full Organization Object ===');
  console.log(JSON.stringify(org, null, 2));
}

const orgId = parseInt(process.argv[2] || '40269');
inspectOrg(orgId).catch(console.error);
