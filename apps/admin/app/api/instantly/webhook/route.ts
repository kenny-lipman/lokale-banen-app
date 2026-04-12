/**
 * Instantly Webhook Endpoint
 *
 * Receives webhook events from Instantly and processes them to sync with Pipedrive.
 * IMPORTANT: Only processes events from campaigns with the "Algemene mailcampagnes" tag.
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
import { InstantlyWebhookPayload, instantlyClient, ALGEMENE_MAILCAMPAGNES_TAG_ID } from '@/lib/instantly-client';
import { createServiceRoleClient } from '@/lib/supabase-server';

// ============================================================================
// CAMPAIGN TAG FILTER CACHE
// ============================================================================

// Cache of campaign IDs that have the "Algemene mailcampagnes" tag
// This is refreshed every 5 minutes to avoid excessive API calls
let algemeneCampagneIdsCache: Set<string> = new Set();
let cacheLastUpdated = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the cached set of "Algemene mailcampagnes" campaign IDs
 * Refreshes the cache if it's expired
 */
async function getAlgemeneCampagneIds(): Promise<Set<string>> {
  const now = Date.now();

  // Refresh cache if expired or empty
  if (algemeneCampagneIdsCache.size === 0 || now - cacheLastUpdated > CACHE_TTL_MS) {
    try {
      console.log('🔄 Refreshing Algemene mailcampagnes cache...');
      const campaigns = await instantlyClient.listAlgemeneCampagnes();
      algemeneCampagneIdsCache = new Set(campaigns.map(c => c.id));
      cacheLastUpdated = now;
      console.log(`✅ Cached ${algemeneCampagneIdsCache.size} Algemene mailcampagnes campaign IDs`);
    } catch (error) {
      console.error('❌ Failed to refresh campaign cache:', error);
      // If cache refresh fails but we have old data, use it
      if (algemeneCampagneIdsCache.size > 0) {
        console.log('⚠️ Using stale cache data');
      }
    }
  }

  return algemeneCampagneIdsCache;
}

/**
 * Check if a campaign is an "Algemene mailcampagnes" campaign
 */
async function isAlgemeneCampagne(campaignId: string): Promise<boolean> {
  const algemeneCampagneIds = await getAlgemeneCampagneIds();
  return algemeneCampagneIds.has(campaignId);
}

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

    // 4. Check if campaign has "Algemene mailcampagnes" tag
    // Only process events from campaigns with this tag
    const isAlgemene = await isAlgemeneCampagne(payload.campaign_id);
    if (!isAlgemene) {
      console.log(`ℹ️ Instantly webhook: Skipping campaign ${payload.campaign_name || payload.campaign_id} - not an "Algemene mailcampagnes" campaign`);
      return NextResponse.json({
        success: true,
        message: 'Campaign not tagged as "Algemene mailcampagnes" - skipped',
        processed: false,
        skippedReason: 'campaign_not_algemene'
      });
    }

    // 5. Check if this is an event type we handle
    // NOTE: reply_received is intentionally EXCLUDED because Instantly fires
    // both reply_received AND an interest event (lead_interested/lead_not_interested/lead_neutral)
    // when someone replies. Using only interest events prevents duplicate notes/status updates.
    const supportedEvents: string[] = [
      // Engagement events
      'email_sent',
      'email_opened',
      'email_link_clicked',

      // Critical events
      'email_bounced',
      'lead_unsubscribed',

      // Campaign events
      'campaign_completed',

      // Interest events (these replace reply_received - include sentiment)
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

    // 6. Check if we have a lead email
    if (!payload.lead_email) {
      console.warn(`⚠️ Instantly webhook: No lead_email in payload for event ${payload.event_type}`);
      return NextResponse.json({
        success: true,
        message: 'No lead email in payload',
        processed: false
      });
    }

    // 7. Post-deletion guard: check if this lead was already removed from Instantly
    // If so, handle reply events lightweight (note in Pipedrive) instead of full re-sync
    const replyEvents = ['lead_interested', 'lead_not_interested', 'lead_neutral'];
    const supabase = createServiceRoleClient();
    const { data: contactForGuard } = await supabase
      .from('contacts')
      .select('id, email, instantly_removed_at')
      .eq('email', payload.lead_email.toLowerCase().trim())
      .not('instantly_removed_at', 'is', null)
      .single();

    if (contactForGuard?.instantly_removed_at) {
      // Lead was already deleted from Instantly
      if (replyEvents.includes(payload.event_type)) {
        // Reply event after deletion → lightweight handling
        console.log(`📨 Post-deletion reply detected for ${payload.lead_email} (removed at: ${contactForGuard.instantly_removed_at})`);
        const postDeletionResult = await instantlyPipedriveSyncService.handlePostDeletionReply(
          mappedPayload,
          {
            id: contactForGuard.id,
            email: contactForGuard.email,
            instantly_removed_at: contactForGuard.instantly_removed_at,
          }
        );

        const duration = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          processed: true,
          postDeletion: true,
          result: {
            leadEmail: postDeletionResult.leadEmail,
            campaignId: postDeletionResult.campaignId,
            pipedrivePersonId: postDeletionResult.pipedrivePersonId,
            pipedriveOrgId: postDeletionResult.pipedriveOrgId,
            skipped: false,
          },
          duration: `${duration}ms`
        });
      } else {
        // Non-reply event after deletion (opens, clicks, bounces) → skip entirely
        console.log(`ℹ️ Skipping post-deletion event ${payload.event_type} for ${payload.lead_email} (removed at: ${contactForGuard.instantly_removed_at})`);
        return NextResponse.json({
          success: true,
          processed: false,
          postDeletion: true,
          message: `Lead already removed from Instantly, non-reply event ${payload.event_type} skipped`,
        });
      }
    }

    // 8. Process the webhook with mapped event type (normal flow)
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
      campaign: ['campaign_completed'],
      interest: ['lead_interested', 'lead_not_interested', 'lead_neutral'],  // These handle replies with sentiment
      meeting: ['lead_meeting_booked', 'lead_meeting_completed', 'lead_closed'],
      special: ['lead_out_of_office', 'lead_wrong_person', 'account_error'],
      customLabels: ['custom_label_any_positive', 'custom_label_any_negative'],
    },
    note: 'reply_received is intentionally excluded - interest events include reply info with sentiment',
    totalEventTypes: 17,
    secretConfigured: !!INSTANTLY_WEBHOOK_SECRET
  });
}
