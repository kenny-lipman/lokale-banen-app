/**
 * Instantly Webhook Endpoint
 *
 * Receives webhook events from Instantly and processes them to sync with Pipedrive.
 *
 * Supported events:
 * - Engagement: email_sent, email_opened, link_clicked (email_link_clicked)
 * - Critical: email_bounced, lead_unsubscribed
 * - Reply: reply_received, auto_reply_received
 * - Campaign: campaign_completed
 * - Interest: lead_interested, lead_not_interested, lead_neutral
 * - Meeting: lead_meeting_booked, lead_meeting_completed, lead_closed
 * - Special: lead_out_of_office, lead_wrong_person, account_error
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  instantlyPipedriveSyncService,
  type SyncEventType
} from '@/lib/services/instantly-pipedrive-sync.service';
import { InstantlyWebhookPayload } from '@/lib/instantly-client';

/**
 * Map Instantly API event types to our internal event types
 * Currently Instantly uses the same names as our internal types
 */
function mapEventType(instantlyEventType: string): SyncEventType {
  // No mapping needed - Instantly API uses same names as our internal types
  return instantlyEventType as SyncEventType;
}

// Webhook secret for validation (optional but recommended)
const INSTANTLY_WEBHOOK_SECRET = process.env.INSTANTLY_WEBHOOK_SECRET;

/**
 * Validate the webhook request
 * Note: Instantly may not support HMAC signatures, so this is optional
 */
function validateWebhook(req: NextRequest): boolean {
  // If no secret is configured, allow all requests
  if (!INSTANTLY_WEBHOOK_SECRET) {
    return true;
  }

  // Check for secret in query params or headers
  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');
  const secretHeader = req.headers.get('x-instantly-secret');

  return secretParam === INSTANTLY_WEBHOOK_SECRET || secretHeader === INSTANTLY_WEBHOOK_SECRET;
}

/**
 * Validate the webhook payload
 */
function isValidPayload(payload: any): payload is InstantlyWebhookPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof payload.event_type === 'string' &&
    typeof payload.campaign_id === 'string'
  );
}

/**
 * POST /api/instantly/webhook
 *
 * Receives webhook events from Instantly
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate webhook secret
    if (!validateWebhook(req)) {
      console.warn('⚠️ Instantly webhook: Invalid or missing secret');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    // 2. Parse the request body
    let payload: InstantlyWebhookPayload;
    try {
      payload = await req.json();
    } catch (parseError) {
      console.error('❌ Instantly webhook: Failed to parse JSON body');
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 3. Validate payload structure
    if (!isValidPayload(payload)) {
      console.error('❌ Instantly webhook: Invalid payload structure', payload);
      return NextResponse.json(
        { error: 'Bad Request', message: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    console.log(`📥 Instantly webhook received: ${payload.event_type} for campaign ${payload.campaign_name || payload.campaign_id}`);

    // 4. Check if this is an event type we handle
    // Note: auto_reply_received is handled as part of reply_received in Instantly
    const supportedEvents = [
      // Engagement events
      'email_sent',
      'email_opened',
      'email_link_clicked',

      // Critical events
      'email_bounced',
      'lead_unsubscribed',

      // Reply events (includes auto-replies)
      'reply_received',

      // Campaign events
      'campaign_completed',

      // Interest events
      'lead_interested',
      'lead_not_interested',
      'lead_neutral',

      // Meeting events (high value!)
      'lead_meeting_booked',
      'lead_meeting_completed',
      'lead_closed',

      // Special events
      'lead_out_of_office',
      'lead_wrong_person',
      'account_error',

      // Custom label events
      'custom_label_any_positive',
      'custom_label_any_negative',
    ];

    if (!supportedEvents.includes(payload.event_type)) {
      console.log(`ℹ️ Instantly webhook: Ignoring unsupported event type: ${payload.event_type}`);
      return NextResponse.json({
        success: true,
        message: `Event type ${payload.event_type} acknowledged but not processed`,
        processed: false
      });
    }

    // Map Instantly event type to our internal event type
    const mappedEventType = mapEventType(payload.event_type);
    const mappedPayload = {
      ...payload,
      event_type: mappedEventType,
    };

    // 5. Check if we have a lead email
    if (!payload.lead_email) {
      console.warn(`⚠️ Instantly webhook: No lead_email in payload for event ${payload.event_type}`);
      return NextResponse.json({
        success: true,
        message: 'No lead email in payload',
        processed: false
      });
    }

    // 6. Process the webhook with mapped event type
    const result = await instantlyPipedriveSyncService.processWebhook(mappedPayload);

    const duration = Date.now() - startTime;
    console.log(`✅ Instantly webhook processed in ${duration}ms:`, {
      event: payload.event_type,
      email: payload.lead_email,
      campaign: payload.campaign_name,
      success: result.success,
      skipped: result.skipped,
      pipedriveOrgId: result.pipedriveOrgId
    });

    return NextResponse.json({
      success: true,
      processed: true,
      result: {
        leadEmail: result.leadEmail,
        campaignId: result.campaignId,
        pipedriveOrgId: result.pipedriveOrgId,
        pipedrivePersonId: result.pipedrivePersonId,
        statusSet: result.statusSet,
        orgCreated: result.orgCreated,
        personCreated: result.personCreated,
        skipped: result.skipped,
        skipReason: result.skipReason,
        error: result.error
      },
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Instantly webhook error:', error);

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/instantly/webhook
 *
 * Health check endpoint for the webhook
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/instantly/webhook',
    supportedEvents: {
      engagement: ['email_sent', 'email_opened', 'email_link_clicked'],
      critical: ['email_bounced', 'lead_unsubscribed'],
      reply: ['reply_received'],  // Includes auto-replies
      campaign: ['campaign_completed'],
      interest: ['lead_interested', 'lead_not_interested', 'lead_neutral'],
      meeting: ['lead_meeting_booked', 'lead_meeting_completed', 'lead_closed'],
      special: ['lead_out_of_office', 'lead_wrong_person', 'account_error'],
      customLabels: ['custom_label_any_positive', 'custom_label_any_negative'],
    },
    totalEventTypes: 18,
    secretConfigured: !!INSTANTLY_WEBHOOK_SECRET
  });
}
