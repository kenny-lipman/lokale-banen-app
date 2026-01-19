/**
 * Script to register all Instantly webhooks
 *
 * Run with: npx ts-node scripts/register-instantly-webhooks.ts
 * Or: pnpm exec tsx scripts/register-instantly-webhooks.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY;
const INSTANTLY_BASE_URL = 'https://api.instantly.ai/api/v2';

// Production webhook URL - update this to your production URL
const WEBHOOK_URL = process.env.INSTANTLY_WEBHOOK_URL || 'https://lokale-banen.vercel.app/api/instantly/webhook';
const WEBHOOK_SECRET = process.env.INSTANTLY_WEBHOOK_SECRET;

// All webhook event types we want to register
const EVENT_TYPES = [
  // Engagement events
  'email_sent',
  'email_opened',
  'link_clicked',

  // Critical events
  'email_bounced',
  'lead_unsubscribed',

  // Reply events
  'reply_received',
  'auto_reply_received',

  // Campaign events
  'campaign_completed',

  // Interest events
  'lead_interested',
  'lead_not_interested',
  'lead_neutral',

  // Meeting events
  'lead_meeting_booked',
  'lead_meeting_completed',
  'lead_closed',

  // Special events
  'lead_out_of_office',
  'lead_wrong_person',
  'account_error',
] as const;

interface Webhook {
  id: string;
  webhook_url: string;
  event_type: string;
  status?: string;
}

async function makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${INSTANTLY_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Authorization': `Bearer ${INSTANTLY_API_KEY}`,
    ...options.headers,
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Instantly API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function listWebhooks(): Promise<Webhook[]> {
  const response = await makeRequest<any>('/webhooks');
  return response.items || response.webhooks || [];
}

async function createWebhook(webhookUrl: string, eventType: string): Promise<Webhook | null> {
  try {
    // Instantly API v2 uses 'target_hook_url' instead of 'webhook_url'
    const response = await makeRequest<Webhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        target_hook_url: webhookUrl,
        event_type: eventType,
      }),
    });
    return response;
  } catch (error) {
    console.error(`Failed to create webhook for ${eventType}:`, error);
    return null;
  }
}

async function deleteWebhook(webhookId: string): Promise<boolean> {
  try {
    await makeRequest(`/webhooks/${webhookId}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error(`Failed to delete webhook ${webhookId}:`, error);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Instantly Webhook Registration Script');
  console.log('='.repeat(60));

  if (!INSTANTLY_API_KEY) {
    console.error('ERROR: INSTANTLY_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Build webhook URL with secret if configured
  let webhookUrl = WEBHOOK_URL;
  if (WEBHOOK_SECRET) {
    webhookUrl += `?secret=${WEBHOOK_SECRET}`;
  }

  console.log(`\nWebhook URL: ${webhookUrl.replace(WEBHOOK_SECRET || '', '***')}`);
  console.log(`\nEvent types to register: ${EVENT_TYPES.length}`);

  // 1. Get existing webhooks
  console.log('\n--- Fetching existing webhooks ---');
  const existingWebhooks = await listWebhooks();
  console.log(`Found ${existingWebhooks.length} existing webhooks:`);

  const existingEventTypes = new Set<string>();
  for (const webhook of existingWebhooks) {
    console.log(`  - ${webhook.event_type} (ID: ${webhook.id})`);
    existingEventTypes.add(webhook.event_type);
  }

  // 2. Determine which webhooks need to be created
  const missingEventTypes = EVENT_TYPES.filter(et => !existingEventTypes.has(et));
  console.log(`\n--- Missing event types: ${missingEventTypes.length} ---`);
  missingEventTypes.forEach(et => console.log(`  - ${et}`));

  if (missingEventTypes.length === 0) {
    console.log('\n All required webhooks already exist!');
    return;
  }

  // 3. Create missing webhooks
  console.log('\n--- Creating missing webhooks ---');
  const created: string[] = [];
  const failed: string[] = [];

  for (const eventType of missingEventTypes) {
    process.stdout.write(`Creating webhook for ${eventType}... `);
    const webhook = await createWebhook(webhookUrl, eventType);

    if (webhook) {
      console.log(`Done (ID: ${webhook.id})`);
      created.push(eventType);
    } else {
      console.log('FAILED');
      failed.push(eventType);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total event types: ${EVENT_TYPES.length}`);
  console.log(`Already existed: ${existingEventTypes.size}`);
  console.log(`Created: ${created.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed event types:`);
    failed.forEach(et => console.log(`  - ${et}`));
  }

  // 5. Final verification
  console.log('\n--- Final verification ---');
  const finalWebhooks = await listWebhooks();
  console.log(`Total webhooks now registered: ${finalWebhooks.length}`);

  const finalEventTypes = new Set(finalWebhooks.map(w => w.event_type));
  const stillMissing = EVENT_TYPES.filter(et => !finalEventTypes.has(et));

  if (stillMissing.length === 0) {
    console.log('\n ALL WEBHOOKS REGISTERED SUCCESSFULLY!');
  } else {
    console.log(`\n Still missing ${stillMissing.length} webhooks:`);
    stillMissing.forEach(et => console.log(`  - ${et}`));
  }
}

main().catch(console.error);
