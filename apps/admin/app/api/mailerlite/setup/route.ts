import { NextRequest, NextResponse } from 'next/server';
import { validateSecretAuth } from '@/lib/api-auth';
import { getMailerLiteClient } from '@/lib/mailerlite-client';

/**
 * POST /api/mailerlite/setup
 *
 * One-time setup: create custom fields and register webhook in MailerLite.
 * Auth: CRON_SECRET
 */

// Custom fields to create in MailerLite
const CUSTOM_FIELDS = [
  { name: 'hoofddomein', type: 'text' as const },
  { name: 'subdomeinen', type: 'text' as const },
  { name: 'branche', type: 'text' as const },
  { name: 'bedrijfsgrootte', type: 'text' as const },
  { name: 'website', type: 'text' as const },
  { name: 'kvk_nummer', type: 'text' as const },
  { name: 'functietitel', type: 'text' as const },
  { name: 'pipedrive_org_id', type: 'text' as const },
  { name: 'pipedrive_person_id', type: 'text' as const },
];

export async function POST(request: NextRequest) {
  // Auth check
  if (!validateSecretAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const client = getMailerLiteClient();
    const results: Array<{ name: string; status: string; id?: string }> = [];

    // 1. Get existing fields to avoid duplicates
    const existingFields = await client.listFields();
    const existingFieldNames = new Set(existingFields.map(f => f.key.toLowerCase()));

    // 2. Create missing custom fields
    for (const field of CUSTOM_FIELDS) {
      if (existingFieldNames.has(field.name.toLowerCase())) {
        results.push({ name: field.name, status: 'already_exists' });
        continue;
      }

      try {
        const created = await client.createField(field.name, field.type);
        results.push({ name: field.name, status: 'created', id: created.data.id });
      } catch (error: any) {
        results.push({ name: field.name, status: `error: ${error.message}` });
      }
    }

    // 3. Register webhook for unsubscribe events
    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('base_url') || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;

    let webhookResult: { status: string; id?: string; url?: string } = { status: 'skipped' };

    if (baseUrl) {
      const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/mailerlite/webhook`;

      // Check existing webhooks to avoid duplicates
      const existingWebhooks = await client.listWebhooks();
      const existingWebhook = existingWebhooks.find(w => w.url === webhookUrl);

      if (existingWebhook) {
        webhookResult = { status: 'already_exists', id: existingWebhook.id, url: webhookUrl };
      } else {
        try {
          const created = await client.createWebhook(webhookUrl, [
            'subscriber.unsubscribed',
            'subscriber.spam_reported',
          ]);
          webhookResult = { status: 'created', id: created.data.id, url: webhookUrl };
        } catch (error: any) {
          webhookResult = { status: `error: ${error.message}` };
        }
      }
    } else {
      webhookResult = { status: 'skipped (no base_url provided)' };
    }

    return NextResponse.json({
      success: true,
      fields: results,
      webhook: webhookResult,
    });
  } catch (error: any) {
    console.error('❌ MailerLite setup error:', error);
    return NextResponse.json(
      { error: error.message || 'Setup failed' },
      { status: 500 }
    );
  }
}
