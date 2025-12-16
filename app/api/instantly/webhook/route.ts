/**
 * Instantly Webhook Endpoint
 *
 * Receives webhook events from Instantly and processes them to sync with Pipedrive.
 *
 * Supported events:
 * - campaign_completed: Lead has completed all steps in the campaign
 * - reply_received: Lead has replied to an email
 * - lead_interested: Lead marked as interested
 * - lead_not_interested: Lead marked as not interested
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  instantlyPipedriveSyncService
} from '@/lib/services/instantly-pipedrive-sync.service';
import { InstantlyWebhookPayload } from '@/lib/instantly-client';

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
    const supportedEvents = [
      'campaign_completed',
      'reply_received',
      'auto_reply_received',
      'lead_interested',
      'lead_not_interested'
    ];

    if (!supportedEvents.includes(payload.event_type)) {
      console.log(`ℹ️ Instantly webhook: Ignoring unsupported event type: ${payload.event_type}`);
      return NextResponse.json({
        success: true,
        message: `Event type ${payload.event_type} acknowledged but not processed`,
        processed: false
      });
    }

    // 5. Check if we have a lead email
    if (!payload.lead_email) {
      console.warn(`⚠️ Instantly webhook: No lead_email in payload for event ${payload.event_type}`);
      return NextResponse.json({
        success: true,
        message: 'No lead email in payload',
        processed: false
      });
    }

    // 6. Process the webhook
    const result = await instantlyPipedriveSyncService.processWebhook(payload);

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
    supportedEvents: [
      'campaign_completed',
      'reply_received',
      'auto_reply_received',
      'lead_interested',
      'lead_not_interested'
    ],
    secretConfigured: !!INSTANTLY_WEBHOOK_SECRET
  });
}
