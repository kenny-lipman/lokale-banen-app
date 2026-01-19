/**
 * Instantly → Pipedrive Sync Service
 *
 * Core business logic for synchronizing Instantly leads to Pipedrive CRM.
 * Handles webhook events, backfill operations, and status management.
 */

import { createServiceRoleClient } from '../supabase-server';
import {
  PipedriveClient,
  pipedriveClient,
  STATUS_PROSPECT_OPTIONS,
  STATUS_PROSPECT_LABELS
} from '../pipedrive-client';
import {
  InstantlyClient,
  instantlyClient,
  InstantlyLead,
  InstantlyWebhookPayload,
  InstantlyWebhookEventType
} from '../instantly-client';

// ============================================================================
// TYPES
// ============================================================================

export type SyncEventType =
  | 'campaign_completed'
  | 'reply_received'
  | 'lead_interested'
  | 'lead_not_interested'
  | 'lead_added'
  | 'backfill';

export type SyncSource = 'webhook' | 'backfill' | 'manual';

export type ReplySentiment = 'positive' | 'negative' | 'neutral';

export interface SyncLeadData {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  // Enrichment data from database
  website?: string;
  city?: string;
  streetAddress?: string;
  postalCode?: string;
  hoofddomein?: string; // Platform name like "GroningseBanen"
  title?: string; // Job title/function
  // Instantly data
  replyCount?: number;
}

export interface SyncOptions {
  hasReply?: boolean;
  replySentiment?: ReplySentiment;
  rawPayload?: any;
  force?: boolean; // Force status update even if protected
}

export interface SyncResult {
  success: boolean;
  leadEmail: string;
  campaignId: string;
  campaignName?: string;
  pipedriveOrgId?: number;
  pipedriveOrgName?: string;
  pipedrivePersonId?: number;
  statusSet?: string;
  orgCreated: boolean;
  personCreated: boolean;
  skipped: boolean;
  skipReason?: string;
  error?: string;
  syncId?: string;
  // Email activity sync tracking
  emailActivitiesSynced?: boolean;
  emailActivitiesCount?: number;
  emailActivitiesError?: string;
  // Instantly lead removal tracking
  instantlyLeadRemoved?: boolean;
}

export interface SyncStats {
  totalSyncs: number;
  byEventType: Record<string, number>;
  byStatus: Record<string, number>;
  byCampaign: Record<string, number>;
  errorsLast24h: number;
  lastSyncAt: string | null;
}

// ============================================================================
// EMAIL VALIDATION & FREEMAIL DETECTION
// ============================================================================

/**
 * List of known freemail domains that should not create organizations
 */
const FREEMAIL_DOMAINS = new Set([
  // Global providers
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'hotmail.nl', 'live.com', 'live.nl', 'msn.com',
  'yahoo.com', 'yahoo.nl', 'yahoo.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me',
  'aol.com',
  'mail.com',
  'zoho.com',
  'yandex.com', 'yandex.ru',
  'gmx.com', 'gmx.net', 'gmx.de',
  // Dutch providers
  'ziggo.nl', 'upcmail.nl',
  'kpnmail.nl', 'kpnplanet.nl', 'planet.nl',
  'xs4all.nl',
  'hetnet.nl',
  'home.nl',
  'casema.nl',
  'quicknet.nl',
  'chello.nl',
  'tele2.nl',
  'telfort.nl',
  'solcon.nl',
  // Other European
  'web.de', 't-online.de', 'freenet.de',
  'orange.fr', 'wanadoo.fr', 'free.fr',
  'libero.it', 'virgilio.it',
]);

/**
 * Check if an email domain is a freemail provider
 */
function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.toLowerCase().trim());
}

/**
 * Validate email format using a simple but effective regex
 */
function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > 254) return false;

  // Simple but effective email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string | null {
  const parts = email.toLowerCase().trim().split('@');
  return parts.length === 2 ? parts[1] : null;
}

// ============================================================================
// STATUS MAPPING
// ============================================================================

/**
 * Map Instantly event types to Pipedrive status prospect keys
 */
function getStatusKeyForEvent(
  eventType: SyncEventType,
  hasReply: boolean,
  replySentiment?: ReplySentiment
): keyof typeof STATUS_PROSPECT_OPTIONS | null {
  // If there's a reply, the reply sentiment determines the status
  if (hasReply || eventType === 'reply_received') {
    if (replySentiment === 'negative' || eventType === 'lead_not_interested') {
      return 'NIET_MEER_BENADEREN';
    }
    // Positive or neutral reply
    return 'BENADEREN';
  }

  // Map event types to status keys
  switch (eventType) {
    case 'campaign_completed':
      return 'NIET_GEREAGEERD_INSTANTLY';
    case 'lead_added':
      return 'IN_CAMPAGNE';
    case 'lead_interested':
      return 'BENADEREN';
    case 'lead_not_interested':
      return 'NIET_MEER_BENADEREN';
    case 'backfill':
      // Backfill assumes campaign completed without reply
      return 'NIET_GEREAGEERD_INSTANTLY';
    default:
      return null;
  }
}

// ============================================================================
// SYNC SERVICE CLASS
// ============================================================================

export class InstantlyPipedriveSyncService {
  private supabase = createServiceRoleClient();
  private pipedriveClient: PipedriveClient;
  private instantlyClient: InstantlyClient;

  constructor(
    pipedriveClientInstance?: PipedriveClient,
    instantlyClientInstance?: InstantlyClient
  ) {
    this.pipedriveClient = pipedriveClientInstance || pipedriveClient;
    this.instantlyClient = instantlyClientInstance || instantlyClient;
  }

  // ============================================================================
  // CORE SYNC METHOD
  // ============================================================================

  /**
   * Main sync method - syncs a lead from Instantly to Pipedrive
   */
  async syncLeadToPipedrive(
    lead: SyncLeadData,
    campaignId: string,
    campaignName: string,
    eventType: SyncEventType,
    syncSource: SyncSource,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      leadEmail: lead.email,
      campaignId,
      campaignName,
      orgCreated: false,
      personCreated: false,
      skipped: false
    };

    try {
      // 0. Validate email format
      if (!isValidEmail(lead.email)) {
        result.skipped = true;
        result.skipReason = `Invalid email format: ${lead.email}`;
        console.warn(`⚠️ Skipping invalid email: ${lead.email}`);
        return result;
      }

      const cleanEmail = lead.email.toLowerCase().trim();
      const emailDomain = extractDomainFromEmail(cleanEmail);

      // 1. Check if already synced for this specific event
      const existingSync = await this.getExistingSync(cleanEmail, campaignId, eventType);
      if (existingSync && !options.force) {
        result.skipped = true;
        result.skipReason = `Already synced for event ${eventType}`;
        result.syncId = existingSync.id;
        return result;
      }

      // 2. Enrich lead data from database (contacts, companies, platforms)
      const enrichedLead = await this.enrichLeadData(lead);
      console.log(`📊 Lead enrichment: company=${enrichedLead.companyName}, hoofddomein=${enrichedLead.hoofddomein}`);

      // 3. Determine the status to set
      const statusKey = getStatusKeyForEvent(
        eventType,
        options.hasReply || false,
        options.replySentiment
      );

      if (!statusKey) {
        result.skipped = true;
        result.skipReason = `No status mapping for event ${eventType}`;
        return result;
      }

      // 4. Check if freemail domain - handle differently
      const isFreemail = emailDomain ? isFreemailDomain(emailDomain) : false;

      let orgResult: { id: number; name: string; created: boolean } | null = null;

      if (isFreemail) {
        // For freemail: only create person without organization (unless company name is provided)
        if (enrichedLead.companyName && enrichedLead.companyName.trim()) {
          // Company name provided from enrichment, use that
          orgResult = await this.pipedriveClient.findOrCreateOrganization(
            enrichedLead.companyName,
            undefined // Don't use email domain for matching
          );
        } else {
          console.log(`📧 Freemail detected (${emailDomain}), skipping organization creation`);
        }
      } else {
        // Regular business email: find or create organization
        orgResult = await this.pipedriveClient.findOrCreateOrganization(
          enrichedLead.companyName,
          emailDomain || undefined
        );
      }

      // For non-freemail, org is required
      if (!isFreemail && !orgResult) {
        result.error = 'Failed to find or create organization';
        await this.logSync(result, eventType, syncSource, options);
        return result;
      }

      if (orgResult) {
        result.pipedriveOrgId = orgResult.id;
        result.pipedriveOrgName = orgResult.name;
        result.orgCreated = orgResult.created;
      }

      // 5. Find or create person (with or without org)
      const personName = [enrichedLead.firstName, enrichedLead.lastName].filter(Boolean).join(' ') || undefined;
      const personResult = await this.pipedriveClient.findOrCreatePersonAdvanced(
        cleanEmail,
        personName,
        orgResult?.id // May be undefined for freemail without company
      );

      if (!personResult) {
        result.error = 'Failed to find or create person';
        await this.logSync(result, eventType, syncSource, options);
        return result;
      }

      result.pipedrivePersonId = personResult.id;
      result.personCreated = personResult.created;

      // 6. Set organization status prospect (only if we have an org)
      if (orgResult) {
        const statusResult = await this.pipedriveClient.setOrganizationStatusProspect(
          orgResult.id,
          statusKey,
          options.force
        );

        if (statusResult.skipped) {
          result.skipped = true;
          result.skipReason = statusResult.reason;
        } else if (!statusResult.success) {
          result.error = statusResult.reason || 'Failed to set status';
          await this.logSync(result, eventType, syncSource, options);
          return result;
        }

        result.statusSet = STATUS_PROSPECT_LABELS[statusKey] || statusKey;

        // 7. Set Hoofddomein if available
        if (enrichedLead.hoofddomein) {
          const hoofddomeinResult = await this.pipedriveClient.setOrganizationHoofddomein(
            orgResult.id,
            enrichedLead.hoofddomein
          );
          if (!hoofddomeinResult.success) {
            console.warn(`⚠️ Could not set Hoofddomein: ${hoofddomeinResult.reason}`);
          }
        }

        // 8. Update organization with enrichment data (website, address)
        await this.updateOrganizationEnrichment(orgResult.id, enrichedLead);

        // 9. Add note to organization about the sync (including email history and reply count)
        await this.addSyncNote(orgResult.id, cleanEmail, campaignName, eventType, statusKey, campaignId, enrichedLead.replyCount);

        // 10. Log email activities to Pipedrive (sent/received emails from Instantly)
        const emailActivityResult = await this.logEmailActivities(orgResult.id, personResult.id, cleanEmail, campaignId);
        result.emailActivitiesSynced = emailActivityResult.success;
        result.emailActivitiesCount = emailActivityResult.count;
        result.emailActivitiesError = emailActivityResult.error;
      } else {
        // Freemail without organization - still mark as success
        console.log(`📧 Freemail lead ${cleanEmail} synced as person only (no organization)`);
        result.emailActivitiesSynced = true; // No org means no email activities to sync
        result.emailActivitiesCount = 0;
      }

      result.success = true;

      // 11. Update person with enrichment data (job title) - always do this
      await this.updatePersonEnrichment(personResult.id, enrichedLead);

      // 12. Log the sync to database
      await this.logSync(result, eventType, syncSource, options);

      // 13. Update Otis contacts & companies tables for visibility in UI
      const contactUpdateResult = await this.updateOtisContact(
        cleanEmail,
        personResult.id,
        campaignId,
        eventType, // Use event type as status (e.g., 'reply_received', 'lead_interested')
        {
          hasReply: options.hasReply,
          replyCount: enrichedLead.replyCount,
          instantlyLeadId: undefined // Could be enhanced to fetch from Instantly API
        }
      );

      // Get contact info for blocklist integration
      const { data: contactData } = await this.supabase
        .from('contacts')
        .select('id, company_id')
        .eq('email', cleanEmail)
        .single();

      await this.updateOtisCompany(
        cleanEmail,
        orgResult?.id,
        orgResult?.name,
        eventType,
        {
          hasReply: options.hasReply,
          replySentiment: options.replySentiment
        }
      );

      // 14. Create blocklist entry if lead is not interested
      if (eventType === 'lead_not_interested') {
        await this.createBlocklistForNotInterested(
          cleanEmail,
          contactData?.id ?? undefined,
          contactData?.company_id ?? undefined
        );
      }

      // 15. Remove lead from Instantly after successful sync to Pipedrive
      // This prevents the lead from being contacted again via Instantly
      const removeResult = await this.removeLeadFromInstantly(cleanEmail, campaignId, contactData?.id);
      if (removeResult.removed) {
        result.instantlyLeadRemoved = true;
        console.log(`🗑️ Removed lead ${cleanEmail} from Instantly after Pipedrive sync`);
      } else if (removeResult.error) {
        console.warn(`⚠️ Could not remove lead from Instantly: ${removeResult.error}`);
      }

      console.log(`✅ Synced ${cleanEmail} to Pipedrive ${orgResult ? `org ${orgResult.id}` : '(person only)'} with status ${statusKey}`);
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Sync failed for ${lead.email}:`, error);

      // Log the failed sync
      await this.logSync(result, eventType, syncSource, options);
      return result;
    }
  }

  // ============================================================================
  // WEBHOOK HANDLER
  // ============================================================================

  /**
   * Process an incoming webhook from Instantly
   */
  async processWebhook(payload: InstantlyWebhookPayload): Promise<SyncResult> {
    const { event_type, campaign_id, campaign_name, lead_email } = payload;

    if (!lead_email) {
      return {
        success: false,
        leadEmail: '',
        campaignId: campaign_id,
        campaignName: campaign_name,
        orgCreated: false,
        personCreated: false,
        skipped: true,
        skipReason: 'No lead email in webhook payload'
      };
    }

    // Determine reply sentiment based on event type
    let hasReply = false;
    let replySentiment: ReplySentiment | undefined;

    if (event_type === 'reply_received') {
      hasReply = true;
      replySentiment = 'neutral'; // Default, could be enhanced with sentiment analysis
    } else if (event_type === 'lead_interested') {
      hasReply = true;
      replySentiment = 'positive';
    } else if (event_type === 'lead_not_interested') {
      hasReply = true;
      replySentiment = 'negative';
    }

    // Map webhook event type to our sync event type
    const syncEventType = this.mapWebhookEventToSyncEvent(event_type);
    if (!syncEventType) {
      return {
        success: false,
        leadEmail: lead_email,
        campaignId: campaign_id,
        campaignName: campaign_name,
        orgCreated: false,
        personCreated: false,
        skipped: true,
        skipReason: `Unsupported event type: ${event_type}`
      };
    }

    // For campaign_completed, check if this lead has already replied
    if (syncEventType === 'campaign_completed') {
      const previousReply = await this.hasReplyForCampaign(lead_email, campaign_id);
      if (previousReply) {
        return {
          success: false,
          leadEmail: lead_email,
          campaignId: campaign_id,
          campaignName: campaign_name,
          orgCreated: false,
          personCreated: false,
          skipped: true,
          skipReason: 'Lead already has a reply recorded for this campaign'
        };
      }
    }

    return this.syncLeadToPipedrive(
      { email: lead_email },
      campaign_id,
      campaign_name,
      syncEventType,
      'webhook',
      {
        hasReply,
        replySentiment,
        rawPayload: payload
      }
    );
  }

  /**
   * Map Instantly webhook event type to our sync event type
   */
  private mapWebhookEventToSyncEvent(
    webhookEventType: InstantlyWebhookEventType | string
  ): SyncEventType | null {
    switch (webhookEventType) {
      case 'campaign_completed':
        return 'campaign_completed';
      case 'reply_received':
      case 'auto_reply_received':
        return 'reply_received';
      case 'lead_interested':
        return 'lead_interested';
      case 'lead_not_interested':
        return 'lead_not_interested';
      default:
        return null;
    }
  }

  // ============================================================================
  // BACKFILL METHODS
  // ============================================================================

  /**
   * Backfill leads from a specific campaign
   *
   * This method intelligently determines the correct Pipedrive status based on:
   * - email_reply_count > 0: Lead has replied → BENADEREN (positive) or needs manual review
   * - interest_status: If set in Instantly, use that to determine interested/not interested
   * - status = 3 (completed) with no reply → NIET_GEREAGEERD_INSTANTLY
   */
  async backfillCampaign(
    campaignId: string,
    options: {
      dryRun?: boolean;
      batchSize?: number;
      skipExisting?: boolean;
    } = {}
  ): Promise<{
    total: number;
    synced: number;
    skipped: number;
    errors: number;
    results: SyncResult[];
  }> {
    const { dryRun = false, batchSize = 50, skipExisting = true } = options;
    const results: SyncResult[] = [];
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`🔄 Starting backfill for campaign ${campaignId}...`);

    // Get campaign info
    const campaign = await this.instantlyClient.getCampaign(campaignId);
    const campaignName = campaign?.name || 'Unknown Campaign';

    // Get all leads for the campaign
    const leads = await this.instantlyClient.listLeadsByCampaign(campaignId);
    console.log(`📊 Found ${leads.length} leads in campaign`);

    // Process leads in batches
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

      for (const lead of batch) {
        // Determine event type and sentiment based on Instantly lead data
        const { eventType, hasReply, replySentiment } = this.determineBackfillEventType(lead);

        // Skip if already synced for this specific event type
        if (skipExisting) {
          const existing = await this.getExistingSync(
            lead.email,
            campaignId,
            eventType
          );
          if (existing) {
            skipped++;
            results.push({
              success: false,
              leadEmail: lead.email,
              campaignId,
              campaignName,
              orgCreated: false,
              personCreated: false,
              skipped: true,
              skipReason: `Already synced for event ${eventType}`
            });
            continue;
          }
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would sync: ${lead.email} as ${eventType} (hasReply: ${hasReply}, sentiment: ${replySentiment})`);
          synced++;
          continue;
        }

        // Sync the lead with the correct event type and sentiment
        const result = await this.syncLeadToPipedrive(
          {
            email: lead.email,
            firstName: lead.first_name,
            lastName: lead.last_name,
            companyName: lead.company_name,
            replyCount: lead.email_reply_count || 0
          },
          campaignId,
          campaignName,
          eventType,
          'backfill',
          {
            hasReply,
            replySentiment
          }
        );

        results.push(result);

        if (result.success) {
          synced++;
        } else if (result.skipped) {
          skipped++;
        } else {
          errors++;
        }

        // Rate limiting
        await this.delay(100);
      }
    }

    console.log(`✅ Backfill complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return {
      total: leads.length,
      synced,
      skipped,
      errors,
      results
    };
  }

  /**
   * Determine the correct event type and sentiment for backfill based on Instantly lead data
   *
   * Instantly lead statuses:
   * - status: -1 = bounced, 0 = not started, 1 = in progress, 2 = paused, 3 = completed
   * - email_reply_count > 0: Lead has replied
   * - interest_status: 1 = interested, -1 = not interested (if set)
   */
  private determineBackfillEventType(lead: InstantlyLead): {
    eventType: SyncEventType;
    hasReply: boolean;
    replySentiment?: ReplySentiment;
  } {
    // Check if lead has replied (from Instantly data)
    const hasReply = (lead.email_reply_count ?? 0) > 0;

    // Check interest_status if available (can be number or string)
    const interestStatus = typeof lead.interest_status === 'string'
      ? parseInt(lead.interest_status, 10)
      : lead.interest_status;

    // If interest status is explicitly set
    if (interestStatus === 1) {
      // Marked as interested
      return {
        eventType: 'lead_interested',
        hasReply: true,
        replySentiment: 'positive'
      };
    }

    if (interestStatus === -1) {
      // Marked as not interested
      return {
        eventType: 'lead_not_interested',
        hasReply: true,
        replySentiment: 'negative'
      };
    }

    // If lead has replied but no interest status set
    if (hasReply) {
      return {
        eventType: 'reply_received',
        hasReply: true,
        replySentiment: 'neutral' // Default to neutral, will set BENADEREN
      };
    }

    // Default: no reply, campaign completed
    return {
      eventType: 'backfill',
      hasReply: false,
      replySentiment: undefined
    };
  }

  /**
   * Backfill all campaigns
   */
  async backfillAllCampaigns(
    options: {
      dryRun?: boolean;
      campaignIds?: string[];
      statusFilter?: string;
    } = {}
  ): Promise<{
    campaigns: number;
    totalLeads: number;
    synced: number;
    skipped: number;
    errors: number;
  }> {
    let totalLeads = 0;
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Get campaigns to process
    let campaigns = await this.instantlyClient.listCampaigns();

    if (options.campaignIds?.length) {
      campaigns = campaigns.filter(c => options.campaignIds!.includes(c.id));
    }

    if (options.statusFilter) {
      campaigns = campaigns.filter(c => c.status === options.statusFilter);
    }

    console.log(`🔄 Starting backfill for ${campaigns.length} campaigns...`);

    for (const campaign of campaigns) {
      console.log(`\n📧 Processing campaign: ${campaign.name}`);

      const result = await this.backfillCampaign(campaign.id, {
        dryRun: options.dryRun,
        skipExisting: true
      });

      totalLeads += result.total;
      synced += result.synced;
      skipped += result.skipped;
      errors += result.errors;
    }

    return {
      campaigns: campaigns.length,
      totalLeads,
      synced,
      skipped,
      errors
    };
  }

  // ============================================================================
  // DATABASE METHODS
  // ============================================================================

  /**
   * Check if a sync already exists for this email/campaign/event combination
   */
  async getExistingSync(
    email: string,
    campaignId: string,
    eventType: SyncEventType
  ): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from('instantly_pipedrive_syncs')
      .select('id')
      .eq('instantly_lead_email', email.toLowerCase().trim())
      .eq('instantly_campaign_id', campaignId)
      .eq('event_type', eventType)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Check if a lead has a reply recorded for a specific campaign
   */
  async hasReplyForCampaign(email: string, campaignId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('instantly_pipedrive_syncs')
      .select('id')
      .eq('instantly_lead_email', email.toLowerCase().trim())
      .eq('instantly_campaign_id', campaignId)
      .eq('has_reply', true)
      .limit(1);

    return !error && data && data.length > 0;
  }

  /**
   * Log a sync operation to the database
   */
  private async logSync(
    result: SyncResult,
    eventType: SyncEventType,
    syncSource: SyncSource,
    options: SyncOptions
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('instantly_pipedrive_syncs')
        .upsert({
          instantly_lead_email: result.leadEmail.toLowerCase().trim(),
          instantly_campaign_id: result.campaignId,
          instantly_campaign_name: result.campaignName,
          pipedrive_org_id: result.pipedriveOrgId,
          pipedrive_org_name: result.pipedriveOrgName,
          pipedrive_person_id: result.pipedrivePersonId,
          event_type: eventType,
          status_prospect_set: result.statusSet,
          sync_source: syncSource,
          has_reply: options.hasReply || false,
          reply_sentiment: options.replySentiment,
          raw_webhook_payload: options.rawPayload,
          sync_success: result.success,
          sync_error: result.error,
          org_created: result.orgCreated,
          person_created: result.personCreated,
          status_skipped: result.skipped,
          skip_reason: result.skipReason,
          // Email activity tracking
          email_activities_synced: result.emailActivitiesSynced ?? false,
          email_activities_count: result.emailActivitiesCount ?? 0,
          email_activities_error: result.emailActivitiesError,
          email_activities_retry_count: 0,
          synced_at: new Date().toISOString()
        }, {
          onConflict: 'instantly_lead_email,instantly_campaign_id,event_type'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error logging sync:', error);
        return null;
      }

      result.syncId = data?.id;
      return data?.id || null;
    } catch (error) {
      console.error('Error logging sync:', error);
      return null;
    }
  }

  /**
   * Update a sync record (e.g., when a reply comes in after campaign_completed)
   */
  async updateSyncWithReply(
    email: string,
    campaignId: string,
    replySentiment: ReplySentiment
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('instantly_pipedrive_syncs')
      .update({
        has_reply: true,
        reply_sentiment: replySentiment,
        updated_at: new Date().toISOString()
      })
      .eq('instantly_lead_email', email.toLowerCase().trim())
      .eq('instantly_campaign_id', campaignId);

    return !error;
  }

  // ============================================================================
  // STATS & MONITORING
  // ============================================================================

  /**
   * Get sync statistics
   */
  async getStats(): Promise<SyncStats> {
    const supabase = this.supabase;

    // Total syncs
    const { count: totalSyncs } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('*', { count: 'exact', head: true });

    // By event type
    const { data: byEventTypeData } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('event_type')
      .not('event_type', 'is', null);

    const byEventType: Record<string, number> = {};
    byEventTypeData?.forEach(row => {
      byEventType[row.event_type] = (byEventType[row.event_type] || 0) + 1;
    });

    // By status
    const { data: byStatusData } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('status_prospect_set')
      .not('status_prospect_set', 'is', null);

    const byStatus: Record<string, number> = {};
    byStatusData?.forEach(row => {
      if (row.status_prospect_set) {
        byStatus[row.status_prospect_set] = (byStatus[row.status_prospect_set] || 0) + 1;
      }
    });

    // By campaign
    const { data: byCampaignData } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('instantly_campaign_name')
      .not('instantly_campaign_name', 'is', null);

    const byCampaign: Record<string, number> = {};
    byCampaignData?.forEach(row => {
      if (row.instantly_campaign_name) {
        byCampaign[row.instantly_campaign_name] = (byCampaign[row.instantly_campaign_name] || 0) + 1;
      }
    });

    // Errors in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: errorsLast24h } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('*', { count: 'exact', head: true })
      .eq('sync_success', false)
      .gte('created_at', oneDayAgo);

    // Last sync
    const { data: lastSyncData } = await supabase
      .from('instantly_pipedrive_syncs')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    return {
      totalSyncs: totalSyncs || 0,
      byEventType,
      byStatus,
      byCampaign,
      errorsLast24h: errorsLast24h || 0,
      lastSyncAt: lastSyncData?.synced_at || null
    };
  }

  /**
   * Get failed syncs for retry
   */
  async getFailedSyncs(limit: number = 100): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('instantly_pipedrive_syncs')
      .select('*')
      .eq('sync_success', false)
      .lt('sync_attempts', 3)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error getting failed syncs:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Retry failed syncs
   */
  async retryFailedSyncs(): Promise<{ retried: number; succeeded: number; failed: number }> {
    const failedSyncs = await this.getFailedSyncs();
    let retried = 0;
    let succeeded = 0;
    let failed = 0;

    for (const sync of failedSyncs) {
      retried++;

      // Increment attempt count
      await this.supabase
        .from('instantly_pipedrive_syncs')
        .update({ sync_attempts: (sync.sync_attempts || 0) + 1 })
        .eq('id', sync.id);

      // Retry the sync
      const result = await this.syncLeadToPipedrive(
        { email: sync.instantly_lead_email },
        sync.instantly_campaign_id,
        sync.instantly_campaign_name || 'Unknown',
        sync.event_type as SyncEventType,
        'manual',
        { force: true }
      );

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      await this.delay(100);
    }

    return { retried, succeeded, failed };
  }

  // ============================================================================
  // DATABASE ENRICHMENT METHODS
  // ============================================================================

  /**
   * Look up enrichment data from the database for a lead by email
   * This searches the contacts table and joins with companies and platforms
   * to get additional data like company info and the Hoofddomein (platform name)
   */
  async getEnrichmentDataByEmail(email: string): Promise<{
    contact?: {
      id: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      title?: string;
    };
    company?: {
      id: string;
      name?: string;
      website?: string;
      phone?: string;
      city?: string;
      streetAddress?: string;
      postalCode?: string;
    };
    hoofddomein?: string;
  } | null> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // First, try to find the contact by email
      const { data: contact, error: contactError } = await this.supabase
        .from('contacts')
        .select(`
          id,
          first_name,
          last_name,
          phone,
          title,
          company_id,
          companies (
            id,
            name,
            website,
            phone,
            city,
            street_address,
            postal_code
          )
        `)
        .eq('email', cleanEmail)
        .limit(1)
        .single();

      if (contactError || !contact) {
        console.log(`📋 No contact found in database for email: ${cleanEmail}`);
        return null;
      }

      // Get the company data
      const company = contact.companies as any;

      // Now get the Hoofddomein (platform) via job_postings
      let hoofddomein: string | undefined;
      if (company?.id) {
        const { data: platformData } = await this.supabase
          .from('job_postings')
          .select(`
            platform_id,
            platforms (
              regio_platform
            )
          `)
          .eq('company_id', company.id)
          .limit(1)
          .single();

        if (platformData?.platforms) {
          hoofddomein = (platformData.platforms as any).regio_platform;
        }
      }

      console.log(`✅ Found enrichment data for ${cleanEmail}: company=${company?.name}, hoofddomein=${hoofddomein}`);

      return {
        contact: {
          id: contact.id,
          firstName: contact.first_name || undefined,
          lastName: contact.last_name || undefined,
          phone: contact.phone || undefined,
          title: contact.title || undefined
        },
        company: company ? {
          id: company.id,
          name: company.name || undefined,
          website: company.website || undefined,
          phone: company.phone || undefined,
          city: company.city || undefined,
          streetAddress: company.street_address || undefined,
          postalCode: company.postal_code || undefined
        } : undefined,
        hoofddomein
      };
    } catch (error) {
      console.error(`Error getting enrichment data for ${email}:`, error);
      return null;
    }
  }

  /**
   * Enrich lead data with database information
   */
  async enrichLeadData(lead: SyncLeadData): Promise<SyncLeadData> {
    const enrichment = await this.getEnrichmentDataByEmail(lead.email);

    if (!enrichment) {
      return lead;
    }

    // Merge enrichment data, preferring existing lead data where available
    return {
      email: lead.email,
      firstName: lead.firstName || enrichment.contact?.firstName,
      lastName: lead.lastName || enrichment.contact?.lastName,
      companyName: lead.companyName || enrichment.company?.name,
      phone: lead.phone || enrichment.contact?.phone || enrichment.company?.phone,
      website: lead.website || enrichment.company?.website,
      city: lead.city || enrichment.company?.city,
      streetAddress: lead.streetAddress || enrichment.company?.streetAddress,
      postalCode: lead.postalCode || enrichment.company?.postalCode,
      hoofddomein: lead.hoofddomein || enrichment.hoofddomein,
      title: lead.title || enrichment.contact?.title,
      replyCount: lead.replyCount
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  // Pipedrive custom field IDs
  private static readonly PIPEDRIVE_FIELDS = {
    ORGANIZATION_WEBSITE: '79f6688e77fed7099077425e7f956d52aaa9defb',
    PERSON_FUNCTIE: 'eff8a3361f8ec8bc1c3edc57b170019bdf9d99f3'
  };

  /**
   * Update organization with enrichment data (website, address)
   */
  private async updateOrganizationEnrichment(
    orgId: number,
    lead: SyncLeadData
  ): Promise<void> {
    try {
      const updates: any = {};

      // Add website if available
      if (lead.website) {
        updates[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_WEBSITE] = lead.website;
      }

      // Add address if available
      if (lead.streetAddress || lead.city || lead.postalCode) {
        updates.address = [lead.streetAddress, lead.postalCode, lead.city]
          .filter(Boolean)
          .join(', ');
      }

      if (Object.keys(updates).length > 0) {
        await this.pipedriveClient.updateOrganization(orgId, updates);
        console.log(`📍 Updated organization ${orgId} with enrichment data (website: ${!!lead.website}, address: ${!!updates.address})`);
      }
    } catch (error) {
      console.warn(`Could not update organization enrichment for ${orgId}:`, error);
    }
  }

  /**
   * Update person with enrichment data (job title/functie)
   */
  private async updatePersonEnrichment(
    personId: number,
    lead: SyncLeadData
  ): Promise<void> {
    try {
      if (!lead.title) return;

      // Update person with Functie field
      const updates: any = {
        [InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.PERSON_FUNCTIE]: lead.title
      };

      await this.pipedriveClient.updatePerson(personId, updates);
      console.log(`👔 Updated person ${personId} with functie: ${lead.title}`);
    } catch (error) {
      console.warn(`Could not update person enrichment for ${personId}:`, error);
    }
  }

  /**
   * Add a note to the organization about the sync, including email history and reply count
   */
  private async addSyncNote(
    orgId: number,
    email: string,
    campaignName: string,
    eventType: SyncEventType,
    statusKey: string,
    campaignId?: string,
    replyCount?: number
  ): Promise<void> {
    try {
      const statusLabel = STATUS_PROSPECT_LABELS[statusKey] || statusKey;
      const eventLabels: Record<SyncEventType, string> = {
        campaign_completed: 'Campagne doorlopen',
        reply_received: 'Reply ontvangen',
        lead_interested: 'Geinteresseerd',
        lead_not_interested: 'Niet geinteresseerd',
        lead_added: 'Toegevoegd aan campagne',
        backfill: 'Backfill sync'
      };

      // Try to get email history from Instantly
      let emailHistorySection = '';
      try {
        const emailSummary = await this.instantlyClient.getLeadEmailSummary(email, campaignId);

        if (emailSummary.totalEmails > 0) {
          emailHistorySection = `\n\n📬 **Email Conversatie** (${emailSummary.sentCount} verzonden, ${emailSummary.receivedCount} ontvangen)\n`;

          for (const emailItem of emailSummary.emails) {
            const date = new Date(emailItem.date).toLocaleDateString('nl-NL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            const icon = emailItem.type === 'sent' ? '➡️' : '⬅️';
            const typeLabel = emailItem.type === 'sent' ? 'Verzonden' : 'Ontvangen';

            emailHistorySection += `\n${icon} **${typeLabel}** (${date})\n`;
            emailHistorySection += `   Onderwerp: ${emailItem.subject}\n`;
            if (emailItem.preview) {
              emailHistorySection += `   ${emailItem.preview}\n`;
            }
          }
        }
      } catch (emailError) {
        console.warn(`Could not fetch email history for ${email}:`, emailError);
      }

      // Build reply count line
      const replyLine = replyCount !== undefined && replyCount > 0
        ? `\n- Replies ontvangen: ${replyCount}`
        : '';

      const content = `
📧 **Instantly Sync**
- Email: ${email}
- Campagne: ${campaignName}
- Event: ${eventLabels[eventType] || eventType}
- Status gezet: ${statusLabel}${replyLine}
- Datum: ${new Date().toLocaleString('nl-NL')}${emailHistorySection}
      `.trim();

      await this.pipedriveClient.addOrganizationNote(orgId, content);
    } catch (error) {
      // Non-critical, just log
      console.warn(`Could not add sync note to org ${orgId}:`, error);
    }
  }

  /**
   * Log email activities from Instantly to Pipedrive
   * Creates individual email activities for each sent/received email
   * Returns status for tracking and retry purposes
   */
  private async logEmailActivities(
    orgId: number,
    personId: number,
    leadEmail: string,
    campaignId?: string
  ): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Get email history from Instantly
      const emails = await this.instantlyClient.getLeadEmailHistory(leadEmail, campaignId);

      if (emails.length === 0) {
        console.log(`📬 No emails found for ${leadEmail}`);
        return { success: true, count: 0 };
      }

      console.log(`📬 Logging ${emails.length} email activities to Pipedrive...`);

      let successCount = 0;
      let failCount = 0;

      for (const email of emails) {
        try {
          // Determine if sent or received
          const isSent = email.to_address_email_list?.toLowerCase().includes(leadEmail.toLowerCase())
            || email.email_type === 'sent';
          const direction: 'sent' | 'received' = isSent ? 'sent' : 'received';

          await this.pipedriveClient.addEmailActivity(orgId, personId, {
            subject: email.subject || '(geen onderwerp)',
            body: email.body?.text || '',
            date: email.timestamp_email,
            direction
          });

          successCount++;

          // Rate limiting between activities
          await this.delay(100);
        } catch (activityError) {
          failCount++;
          console.warn(`Could not log email activity:`, activityError);
        }
      }

      console.log(`✅ Logged ${successCount}/${emails.length} email activities to Pipedrive`);

      if (failCount > 0) {
        return {
          success: false,
          count: successCount,
          error: `Failed to log ${failCount} of ${emails.length} email activities`
        };
      }

      return { success: true, count: successCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Could not log email activities for ${leadEmail}:`, error);
      return { success: false, count: 0, error: errorMessage };
    }
  }

  /**
   * Retry failed email activity syncs
   * Call this method to process queued failed syncs
   */
  async retryFailedEmailActivities(limit: number = 50): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      // Get syncs where email activities failed
      const { data: failedSyncs, error } = await this.supabase
        .from('instantly_pipedrive_syncs')
        .select('*')
        .eq('sync_success', true) // Main sync succeeded
        .eq('email_activities_synced', false) // But email activities failed
        .lt('email_activities_retry_count', 3) // Less than 3 retries
        .order('synced_at', { ascending: true })
        .limit(limit);

      if (error || !failedSyncs) {
        console.error('Error fetching failed email activity syncs:', error);
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      for (const sync of failedSyncs) {
        processed++;

        if (!sync.pipedrive_org_id || !sync.pipedrive_person_id) {
          console.warn(`Skip retry for ${sync.instantly_lead_email}: missing org or person ID`);
          continue;
        }

        // Increment retry count first
        await this.supabase
          .from('instantly_pipedrive_syncs')
          .update({
            email_activities_retry_count: (sync.email_activities_retry_count || 0) + 1
          })
          .eq('id', sync.id);

        // Retry the email activity sync
        const result = await this.logEmailActivities(
          sync.pipedrive_org_id,
          sync.pipedrive_person_id,
          sync.instantly_lead_email,
          sync.instantly_campaign_id
        );

        if (result.success) {
          // Update sync record
          await this.supabase
            .from('instantly_pipedrive_syncs')
            .update({
              email_activities_synced: true,
              email_activities_count: result.count,
              email_activities_error: null
            })
            .eq('id', sync.id);

          succeeded++;
          console.log(`✅ Retry succeeded for ${sync.instantly_lead_email}`);
        } else {
          // Update with error
          await this.supabase
            .from('instantly_pipedrive_syncs')
            .update({
              email_activities_error: result.error
            })
            .eq('id', sync.id);

          failed++;
          console.warn(`❌ Retry failed for ${sync.instantly_lead_email}: ${result.error}`);
        }

        // Rate limiting
        await this.delay(200);
      }

      console.log(`📧 Email activity retry complete: ${succeeded}/${processed} succeeded, ${failed} failed`);
      return { processed, succeeded, failed };
    } catch (error) {
      console.error('Error in retryFailedEmailActivities:', error);
      return { processed, succeeded, failed };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // OTIS SYNC - UPDATE CONTACTS & COMPANIES TABLES
  // ============================================================================

  /**
   * Update the contacts table with sync information
   * This ensures visibility in /contacts page for which contacts are synced
   */
  private async updateOtisContact(
    email: string,
    pipedrivePersonId: number | undefined,
    campaignId: string | undefined,
    instantlyStatus: string,
    options: {
      hasReply?: boolean;
      replyCount?: number;
      instantlyLeadId?: string;
    } = {}
  ): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // First check if contact exists
      const { data: existingContact } = await this.supabase
        .from('contacts')
        .select('id, instantly_campaign_ids, reply_count')
        .eq('email', cleanEmail)
        .single();

      if (!existingContact) {
        console.log(`📋 No Otis contact found for ${cleanEmail}, skipping contact update`);
        return;
      }

      // Build campaign IDs array (append if not already present)
      let campaignIds = existingContact.instantly_campaign_ids || [];
      if (campaignId && !campaignIds.includes(campaignId)) {
        campaignIds = [...campaignIds, campaignId];
      }

      // Update contact with sync info
      const updateData: any = {
        instantly_synced: true,
        instantly_synced_at: new Date().toISOString(),
        instantly_status: instantlyStatus,
        instantly_campaign_ids: campaignIds,
        // Always update last_touch when syncing
        last_touch: new Date().toISOString().split('T')[0], // DATE format
        // Set qualification_status to in_campaign
        qualification_status: 'in_campaign'
      };

      // Add Instantly lead ID if available
      if (options.instantlyLeadId) {
        updateData.instantly_id = options.instantlyLeadId;
      }

      // Add Pipedrive person ID if available
      if (pipedrivePersonId) {
        updateData.pipedrive_person_id = pipedrivePersonId.toString();
        updateData.pipedrive_synced = true;
        updateData.pipedrive_synced_at = new Date().toISOString();
      }

      // Update reply tracking if this is a reply event
      if (options.hasReply) {
        // Increment reply count (use provided count or increment by 1)
        const newReplyCount = options.replyCount ?? ((existingContact.reply_count || 0) + 1);
        updateData.reply_count = newReplyCount;
        updateData.last_reply_at = new Date().toISOString();
      }

      const { error } = await this.supabase
        .from('contacts')
        .update(updateData)
        .eq('id', existingContact.id);

      if (error) {
        console.warn(`⚠️ Could not update Otis contact ${cleanEmail}:`, error.message);
      } else {
        console.log(`📋 Updated Otis contact ${cleanEmail} with sync info (qualification: in_campaign, last_touch: today${options.hasReply ? ', reply tracked' : ''})`);
      }
    } catch (error) {
      console.warn(`Could not update Otis contact for ${email}:`, error);
    }
  }

  /**
   * Update the companies table with sync information
   * This ensures visibility in /companies page for which companies are synced
   */
  private async updateOtisCompany(
    email: string,
    pipedriveOrgId: number | undefined,
    pipedriveOrgName: string | undefined,
    eventType: SyncEventType,
    options: {
      hasReply?: boolean;
      replySentiment?: ReplySentiment;
    } = {}
  ): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();
      const emailDomain = cleanEmail.split('@')[1];

      if (!emailDomain) return;

      // Try to find company by:
      // 1. Contact's company_id (via contact email)
      // 2. Website domain match
      // 3. Name match with Pipedrive org name

      // First try via contact
      const { data: contact } = await this.supabase
        .from('contacts')
        .select('company_id')
        .eq('email', cleanEmail)
        .single();

      let companyId: string | null = contact?.company_id || null;

      // If no company via contact, try website domain
      if (!companyId) {
        const { data: companyByDomain } = await this.supabase
          .from('companies')
          .select('id')
          .or(`website.ilike.%${emailDomain}%,website.ilike.%${emailDomain.replace('.nl', '').replace('.com', '')}%`)
          .limit(1)
          .single();

        companyId = companyByDomain?.id || null;
      }

      // If still no company and we have org name, try name match
      if (!companyId && pipedriveOrgName) {
        const { data: companyByName } = await this.supabase
          .from('companies')
          .select('id')
          .ilike('name', `%${pipedriveOrgName}%`)
          .limit(1)
          .single();

        companyId = companyByName?.id || null;
      }

      if (!companyId) {
        console.log(`📋 No Otis company found for ${emailDomain}, skipping company update`);
        return;
      }

      // Get current company data for stats calculation
      const { data: currentCompany } = await this.supabase
        .from('companies')
        .select('contacts_in_campaign, status, qualification_status')
        .eq('id', companyId)
        .single();

      // Build update data
      const updateData: any = {
        pipedrive_synced: true,
        pipedrive_synced_at: new Date().toISOString()
      };

      // Add Pipedrive org ID if available
      if (pipedriveOrgId) {
        updateData.pipedrive_id = pipedriveOrgId.toString();
      }

      // Increment contacts_in_campaign (we'll recalculate properly later)
      // For now, just increment if this is a new contact being synced
      const currentContactsInCampaign = currentCompany?.contacts_in_campaign || 0;
      updateData.contacts_in_campaign = currentContactsInCampaign + 1;

      // Determine company status and qualification_status based on event type
      const statusMapping = this.getCompanyStatusForEvent(eventType, options.hasReply, options.replySentiment);

      // Only update status if we have a mapping and current status allows it
      if (statusMapping.status && this.shouldUpdateCompanyStatus(currentCompany?.status, statusMapping.status)) {
        updateData.status = statusMapping.status;
      }

      if (statusMapping.qualificationStatus && this.shouldUpdateQualificationStatus(currentCompany?.qualification_status, statusMapping.qualificationStatus)) {
        updateData.qualification_status = statusMapping.qualificationStatus;
      }

      // Set is_customer for interested leads (optional - only if explicitly interested)
      if (eventType === 'lead_interested') {
        updateData.is_customer = false; // They're interested, but not a customer yet - just a qualified lead
      }

      const { error } = await this.supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId);

      if (error) {
        console.warn(`⚠️ Could not update Otis company ${companyId}:`, error.message);
      } else {
        console.log(`📋 Updated Otis company ${companyId} (status: ${updateData.status || 'unchanged'}, qualification: ${updateData.qualification_status || 'unchanged'}, contacts_in_campaign: ${updateData.contacts_in_campaign})`);
      }

      // Recalculate campaign reply rate for this company
      await this.recalculateCompanyCampaignStats(companyId);

    } catch (error) {
      console.warn(`Could not update Otis company for ${email}:`, error);
    }
  }

  /**
   * Get the company status and qualification_status based on the sync event type
   */
  private getCompanyStatusForEvent(
    eventType: SyncEventType,
    hasReply?: boolean,
    replySentiment?: ReplySentiment
  ): { status: string | null; qualificationStatus: string | null } {
    // If there's a reply, determine status based on sentiment
    if (hasReply || eventType === 'reply_received') {
      if (replySentiment === 'negative' || eventType === 'lead_not_interested') {
        return { status: 'Niet meer benaderen', qualificationStatus: 'disqualified' };
      }
      if (replySentiment === 'positive' || eventType === 'lead_interested') {
        return { status: 'Benaderen', qualificationStatus: 'qualified' };
      }
      // Neutral reply - needs review
      return { status: 'Benaderen', qualificationStatus: 'review' };
    }

    // Map event types to status
    switch (eventType) {
      case 'lead_interested':
        return { status: 'Benaderen', qualificationStatus: 'qualified' };
      case 'lead_not_interested':
        return { status: 'Niet meer benaderen', qualificationStatus: 'disqualified' };
      case 'campaign_completed':
      case 'backfill':
        // No reply after campaign - keep as prospect, but mark as enriched (contacted)
        return { status: null, qualificationStatus: 'enriched' };
      case 'lead_added':
        // Just added to campaign - no status change yet
        return { status: null, qualificationStatus: null };
      default:
        return { status: null, qualificationStatus: null };
    }
  }

  /**
   * Determine if we should update the company status (don't downgrade important statuses)
   */
  private shouldUpdateCompanyStatus(currentStatus: string | null | undefined, newStatus: string): boolean {
    // Status priority (higher = more important, don't overwrite)
    const statusPriority: Record<string, number> = {
      'Klant': 100,
      'Benaderen': 50,
      'opnieuw benaderen': 40,
      'Niet meer benaderen': 30,
      'Qualified': 20,
      'Disqualified': 15,
      'Prospect': 10
    };

    const currentPriority = statusPriority[currentStatus || 'Prospect'] || 0;
    const newPriority = statusPriority[newStatus] || 0;

    // Only update if new status has higher or equal priority
    // Exception: always allow setting to "Niet meer benaderen" (they said no)
    if (newStatus === 'Niet meer benaderen') return true;

    return newPriority >= currentPriority;
  }

  /**
   * Determine if we should update qualification status
   */
  private shouldUpdateQualificationStatus(currentStatus: string | null | undefined, newStatus: string): boolean {
    // Qualification priority
    const qualPriority: Record<string, number> = {
      'qualified': 100,
      'disqualified': 90, // Always respect disqualification
      'review': 50,
      'enriched': 40,
      'pending': 10
    };

    const currentPriority = qualPriority[currentStatus || 'pending'] || 0;
    const newPriority = qualPriority[newStatus] || 0;

    // Always allow disqualification
    if (newStatus === 'disqualified') return true;

    return newPriority >= currentPriority;
  }

  /**
   * Recalculate campaign statistics for a company
   */
  private async recalculateCompanyCampaignStats(companyId: string): Promise<void> {
    try {
      // Count contacts in campaign for this company
      const { count: contactsInCampaign } = await this.supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('instantly_synced', true);

      // Count contacts with replies
      const { count: contactsWithReplies } = await this.supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('instantly_synced', true)
        .gt('reply_count', 0);

      // Calculate reply rate
      const replyRate = contactsInCampaign && contactsInCampaign > 0
        ? ((contactsWithReplies || 0) / contactsInCampaign) * 100
        : 0;

      // Update company with accurate stats
      await this.supabase
        .from('companies')
        .update({
          contacts_in_campaign: contactsInCampaign || 0,
          campaign_reply_rate: Math.round(replyRate * 100) / 100 // Round to 2 decimals
        })
        .eq('id', companyId);

      console.log(`📊 Updated company ${companyId} stats: ${contactsInCampaign} contacts, ${replyRate.toFixed(1)}% reply rate`);
    } catch (error) {
      console.warn(`Could not recalculate campaign stats for company ${companyId}:`, error);
    }
  }

  // ============================================================================
  // BLOCKLIST INTEGRATION
  // ============================================================================

  /**
   * Create a blocklist entry when a lead marks themselves as not interested
   * This adds the email to:
   * 1. Our database blocklist_entries table
   * 2. Instantly blocklist (via API)
   * 3. Marks the contact as blocked
   */
  private async createBlocklistForNotInterested(
    email: string,
    contactId: string | undefined,
    companyId: string | undefined,
    reason: string = 'Instantly - Niet geïnteresseerd'
  ): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Check if blocklist entry already exists
      const { data: existingEntry } = await this.supabase
        .from('blocklist_entries')
        .select('id')
        .eq('value', cleanEmail)
        .eq('type', 'email')
        .single();

      if (existingEntry) {
        console.log(`📋 Blocklist entry already exists for ${cleanEmail}`);
        return;
      }

      // 1. Add to Instantly blocklist via API
      let instantlyId: string | undefined;
      let instantlySynced = false;
      let instantlyError: string | undefined;

      try {
        const instantlyResult = await this.instantlyClient.addToBlocklist(cleanEmail);
        instantlyId = instantlyResult.id;
        instantlySynced = true;
        console.log(`✅ Added ${cleanEmail} to Instantly blocklist`);
      } catch (instantlyErr) {
        instantlyError = instantlyErr instanceof Error ? instantlyErr.message : 'Unknown error';
        console.warn(`⚠️ Could not add ${cleanEmail} to Instantly blocklist:`, instantlyError);
        // Continue with database entry even if Instantly fails
      }

      // 2. Create blocklist entry in our database
      const { error: blocklistError } = await this.supabase
        .from('blocklist_entries')
        .insert({
          type: 'email',
          value: cleanEmail,
          reason: reason,
          blocklist_level: 'contact',
          contact_id: contactId || null,
          company_id: companyId || null,
          instantly_synced: instantlySynced,
          instantly_synced_at: instantlySynced ? new Date().toISOString() : null,
          instantly_id: instantlyId || null,
          instantly_error: instantlyError || null,
          is_active: true
        });

      if (blocklistError) {
        console.warn(`⚠️ Could not create blocklist entry for ${cleanEmail}:`, blocklistError.message);
        return;
      }

      // 3. Mark the contact as blocked if we have a contact ID
      if (contactId) {
        await this.supabase
          .from('contacts')
          .update({ is_blocked: true })
          .eq('id', contactId);
      }

      console.log(`🚫 Created blocklist entry for ${cleanEmail} (not interested, instantly_synced: ${instantlySynced})`);
    } catch (error) {
      console.warn(`Could not create blocklist entry for ${email}:`, error);
    }
  }

  // ============================================================================
  // INSTANTLY LEAD REMOVAL
  // ============================================================================

  /**
   * Remove a lead from Instantly after successful sync to Pipedrive
   * This ensures the lead won't be contacted again via Instantly cold outreach
   * Updates the contact's instantly_removed_at and qualification_status
   */
  private async removeLeadFromInstantly(
    email: string,
    campaignId: string,
    contactId: string | undefined
  ): Promise<{ removed: boolean; error?: string }> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Try to delete the lead from Instantly
      const deletedLead = await this.instantlyClient.deleteLeadByEmail(cleanEmail, campaignId);

      if (!deletedLead) {
        // Lead not found in Instantly - might have been removed already
        console.log(`Lead ${cleanEmail} not found in Instantly (campaign: ${campaignId}), may have been removed already`);
      }

      // Update contact in database with removal timestamp and new status
      if (contactId) {
        const { error: updateError } = await this.supabase
          .from('contacts')
          .update({
            instantly_removed_at: new Date().toISOString(),
            qualification_status: 'synced_to_pipedrive'
          })
          .eq('id', contactId);

        if (updateError) {
          console.warn(`Could not update contact ${contactId} after Instantly removal:`, updateError.message);
        }
      } else {
        // Try to find and update the contact by email
        const { error: updateError } = await this.supabase
          .from('contacts')
          .update({
            instantly_removed_at: new Date().toISOString(),
            qualification_status: 'synced_to_pipedrive'
          })
          .eq('email', cleanEmail);

        if (updateError) {
          console.warn(`Could not update contact by email ${cleanEmail} after Instantly removal:`, updateError.message);
        }
      }

      return { removed: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to remove lead ${email} from Instantly:`, error);
      return { removed: false, error: errorMessage };
    }
  }
}

// Export singleton instance
export const instantlyPipedriveSyncService = new InstantlyPipedriveSyncService();
