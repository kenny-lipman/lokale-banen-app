/**
 * Instantly Webhook Setup Endpoint
 *
 * Creates webhooks in Instantly for all required event types.
 * This should be called once during initial setup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { instantlyClient, InstantlyWebhookEventType } from '@/lib/instantly-client';

// The base URL for our webhook endpoint
const getWebhookUrl = (req: NextRequest): string => {
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Add secret if configured
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (secret) {
    return `${baseUrl}/api/instantly/webhook?secret=${secret}`;
  }

  return `${baseUrl}/api/instantly/webhook`;
};

// Event types we want to subscribe to
// Full list of all supported Instantly webhook event types
// Note: auto_reply_received is handled as part of reply_received
const REQUIRED_EVENT_TYPES: InstantlyWebhookEventType[] = [
  // Engagement events - track email interactions
  'email_sent',
  'email_opened',
  'email_link_clicked',  // Correct Instantly API name

  // Critical events - blocklist triggers
  'email_bounced',
  'lead_unsubscribed',

  // Reply events (includes auto-replies)
  'reply_received',

  // Campaign events
  'campaign_completed',

  // Interest events - lead qualification
  'lead_interested',
  'lead_not_interested',
  'lead_neutral',

  // Meeting events - high value leads!
  'lead_meeting_booked',
  'lead_meeting_completed',
  'lead_closed',

  // Special events
  'lead_out_of_office',
  'lead_wrong_person',
  'account_error',
];

/**
 * POST /api/instantly/webhook/setup
 *
 * Creates webhooks in Instantly for all required event types
 */
export async function POST(req: NextRequest) {
  try {
    // Parse optional body for custom webhook URL
    let customWebhookUrl: string | undefined;
    try {
      const body = await req.json();
      customWebhookUrl = body.webhook_url;
    } catch {
      // No body provided, use default
    }

    const webhookUrl = customWebhookUrl || getWebhookUrl(req);
    console.log(`🔧 Setting up Instantly webhooks with URL: ${webhookUrl}`);

    // Get existing webhooks
    const existingWebhooks = await instantlyClient.listWebhooks();
    console.log(`📋 Found ${existingWebhooks.length} existing webhooks`);

    // Check which event types are already configured
    const existingEventTypes = new Set(existingWebhooks.map(w => w.event_type));
    const missingEventTypes = REQUIRED_EVENT_TYPES.filter(et => !existingEventTypes.has(et));

    if (missingEventTypes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All required webhooks already exist',
        webhookUrl,
        existingWebhooks: existingWebhooks.map(w => ({
          id: w.id,
          event_type: w.event_type,
          webhook_url: w.webhook_url
        }))
      });
    }

    // Create missing webhooks
    const results = await instantlyClient.createWebhooks(webhookUrl, missingEventTypes);

    console.log(`✅ Created ${results.success.length} webhooks, ${results.failed.length} failed`);

    return NextResponse.json({
      success: results.failed.length === 0,
      message: `Created ${results.success.length} webhooks`,
      webhookUrl,
      created: results.success.map(w => ({
        id: w.id,
        event_type: w.event_type
      })),
      failed: results.failed,
      alreadyExisted: REQUIRED_EVENT_TYPES.filter(et => existingEventTypes.has(et))
    });
  } catch (error) {
    console.error('❌ Error setting up Instantly webhooks:', error);
    return NextResponse.json(
      {
        error: 'Failed to setup webhooks',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instantly/webhook/setup
 *
 * Lists existing webhooks in Instantly
 */
export async function GET(req: NextRequest) {
  try {
    const webhooks = await instantlyClient.listWebhooks();

    // Check which required event types are missing
    const configuredEventTypes = new Set(webhooks.map(w => w.event_type));
    const missingEventTypes = REQUIRED_EVENT_TYPES.filter(et => !configuredEventTypes.has(et));

    return NextResponse.json({
      webhooks: webhooks.map(w => ({
        id: w.id,
        event_type: w.event_type,
        webhook_url: w.webhook_url,
        status: w.status
      })),
      requiredEventTypes: REQUIRED_EVENT_TYPES,
      missingEventTypes,
      isComplete: missingEventTypes.length === 0
    });
  } catch (error) {
    console.error('❌ Error listing Instantly webhooks:', error);
    return NextResponse.json(
      {
        error: 'Failed to list webhooks',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/instantly/webhook/setup
 *
 * Deletes all webhooks (for cleanup/reset)
 */
export async function DELETE(req: NextRequest) {
  try {
    const webhooks = await instantlyClient.listWebhooks();

    if (webhooks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No webhooks to delete'
      });
    }

    const results: { id: string; deleted: boolean }[] = [];

    for (const webhook of webhooks) {
      const deleted = await instantlyClient.deleteWebhook(webhook.id);
      results.push({ id: webhook.id, deleted });
    }

    const deletedCount = results.filter(r => r.deleted).length;
    console.log(`🗑️ Deleted ${deletedCount}/${webhooks.length} webhooks`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} webhooks`,
      results
    });
  } catch (error) {
    console.error('❌ Error deleting Instantly webhooks:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete webhooks',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
