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

      // 2. Determine the status to set
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

      // 3. Find or create organization
      const emailDomain = PipedriveClient.extractDomainFromEmail(cleanEmail);
      const orgResult = await this.pipedriveClient.findOrCreateOrganization(
        lead.companyName,
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

      // 4. Find or create person
      const personName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || undefined;
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

      // 5. Set organization status prospect
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
      result.success = true;

      // 6. Add note to organization about the sync
      await this.addSyncNote(orgResult.id, cleanEmail, campaignName, eventType, statusKey);

      // 7. Log the sync to database
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
        // Skip if already synced
        if (skipExisting) {
          const existing = await this.getExistingSync(
            lead.email,
            campaignId,
            'campaign_completed'
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
              skipReason: 'Already synced'
            });
            continue;
          }
        }

        // Check if lead has replied in this campaign
        const hasReply = await this.hasReplyForCampaign(lead.email, campaignId);
        if (hasReply) {
          skipped++;
          results.push({
            success: false,
            leadEmail: lead.email,
            campaignId,
            campaignName,
            orgCreated: false,
            personCreated: false,
            skipped: true,
            skipReason: 'Lead has reply in this campaign'
          });
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would sync: ${lead.email}`);
          synced++;
          continue;
        }

        // Sync the lead
        const result = await this.syncLeadToPipedrive(
          {
            email: lead.email,
            firstName: lead.first_name,
            lastName: lead.last_name,
            companyName: lead.company_name
          },
          campaignId,
          campaignName,
          'backfill',
          'backfill'
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
  // HELPER METHODS
  // ============================================================================

  /**
   * Add a note to the organization about the sync
   */
  private async addSyncNote(
    orgId: number,
    email: string,
    campaignName: string,
    eventType: SyncEventType,
    statusKey: string
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

      const content = `
📧 **Instantly Sync**
- Email: ${email}
- Campagne: ${campaignName}
- Event: ${eventLabels[eventType] || eventType}
- Status gezet: ${statusLabel}
- Datum: ${new Date().toLocaleString('nl-NL')}
      `.trim();

      await this.pipedriveClient.addOrganizationNote(orgId, content);
    } catch (error) {
      // Non-critical, just log
      console.warn(`Could not add sync note to org ${orgId}:`, error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const instantlyPipedriveSyncService = new InstantlyPipedriveSyncService();
