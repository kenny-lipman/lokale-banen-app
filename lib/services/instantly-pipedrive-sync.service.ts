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
      const cleanEmail = lead.email.toLowerCase().trim();

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

      // 4. Find or create organization
      const emailDomain = PipedriveClient.extractDomainFromEmail(cleanEmail);
      const orgResult = await this.pipedriveClient.findOrCreateOrganization(
        enrichedLead.companyName,
        emailDomain || undefined
      );

      if (!orgResult) {
        result.error = 'Failed to find or create organization';
        await this.logSync(result, eventType, syncSource, options);
        return result;
      }

      result.pipedriveOrgId = orgResult.id;
      result.pipedriveOrgName = orgResult.name;
      result.orgCreated = orgResult.created;

      // 5. Find or create person
      const personName = [enrichedLead.firstName, enrichedLead.lastName].filter(Boolean).join(' ') || undefined;
      const personResult = await this.pipedriveClient.findOrCreatePersonAdvanced(
        cleanEmail,
        personName,
        orgResult.id
      );

      if (!personResult) {
        result.error = 'Failed to find or create person';
        await this.logSync(result, eventType, syncSource, options);
        return result;
      }

      result.pipedrivePersonId = personResult.id;
      result.personCreated = personResult.created;

      // 6. Set organization status prospect
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

      result.success = true;

      // 8. Update organization with enrichment data (website, address)
      await this.updateOrganizationEnrichment(orgResult.id, enrichedLead);

      // 9. Update person with enrichment data (job title)
      await this.updatePersonEnrichment(personResult.id, enrichedLead);

      // 10. Add note to organization about the sync (including email history and reply count)
      await this.addSyncNote(orgResult.id, cleanEmail, campaignName, eventType, statusKey, campaignId, enrichedLead.replyCount);

      // 11. Log email activities to Pipedrive (sent/received emails from Instantly)
      await this.logEmailActivities(orgResult.id, personResult.id, cleanEmail, campaignId);

      // 12. Log the sync to database
      await this.logSync(result, eventType, syncSource, options);

      console.log(`✅ Synced ${cleanEmail} to Pipedrive org ${orgResult.id} with status ${statusKey}`);
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
        // Pipedrive uses custom_fields for some fields, but website might be a standard field
        // Let's check and use the right approach
        updates.custom_fields = updates.custom_fields || {};
        // For now, we'll skip website as it requires knowing the exact field key
        // TODO: Add website field ID when known
      }

      // Add address if available
      if (lead.streetAddress || lead.city || lead.postalCode) {
        updates.address = [lead.streetAddress, lead.postalCode, lead.city]
          .filter(Boolean)
          .join(', ');
      }

      if (Object.keys(updates).length > 0 && updates.address) {
        await this.pipedriveClient.updateOrganization(orgId, updates);
        console.log(`📍 Updated organization ${orgId} with address data`);
      }
    } catch (error) {
      console.warn(`Could not update organization enrichment for ${orgId}:`, error);
    }
  }

  /**
   * Update person with enrichment data (job title)
   */
  private async updatePersonEnrichment(
    personId: number,
    lead: SyncLeadData
  ): Promise<void> {
    try {
      if (!lead.title) return;

      // Pipedrive uses custom fields for job title - we need to find the field ID
      // For now, we'll add it to the person's name as a workaround if needed
      // TODO: Find the job_title field ID in Pipedrive
      console.log(`📋 Person ${personId} has job title: ${lead.title} (not yet synced - need field ID)`);
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
   */
  private async logEmailActivities(
    orgId: number,
    personId: number,
    leadEmail: string,
    campaignId?: string
  ): Promise<void> {
    try {
      // Get email history from Instantly
      const emails = await this.instantlyClient.getLeadEmailHistory(leadEmail, campaignId);

      if (emails.length === 0) {
        console.log(`📬 No emails found for ${leadEmail}`);
        return;
      }

      console.log(`📬 Logging ${emails.length} email activities to Pipedrive...`);

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

          // Rate limiting between activities
          await this.delay(100);
        } catch (activityError) {
          console.warn(`Could not log email activity:`, activityError);
        }
      }

      console.log(`✅ Logged ${emails.length} email activities to Pipedrive`);
    } catch (error) {
      // Non-critical, just log
      console.warn(`Could not log email activities for ${leadEmail}:`, error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const instantlyPipedriveSyncService = new InstantlyPipedriveSyncService();
