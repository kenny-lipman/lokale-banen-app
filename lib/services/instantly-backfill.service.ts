/**
 * Instantly Backfill Queue Service
 *
 * Manages queue-based backfill operations for syncing Instantly leads to Pipedrive.
 * Designed for scalable processing of 10-20K leads with real-time frontend monitoring.
 */

import { createServiceRoleClient } from '../supabase-server';
import { instantlyClient, InstantlyLead, InstantlyClient } from '../instantly-client';
import {
  instantlyPipedriveSyncService,
  SyncResult,
  ReplySentiment,
} from './instantly-pipedrive-sync.service';
import {
  determineLeadStatus,
  type LeadStatusContext,
  type CustomLabelMap,
} from './lead-status-determination';

// ============================================================================
// TYPES
// ============================================================================

export type BackfillBatchStatus =
  | 'pending'
  | 'collecting'
  | 'processing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BackfillLeadStatus = 'pending' | 'processing' | 'synced' | 'skipped' | 'failed';

export interface BackfillBatch {
  id: string;
  batch_id: string;
  campaign_ids: string[];
  dry_run: boolean;
  batch_size: number;
  delay_ms: number;
  max_leads_to_collect: number | null; // Limit for collection phase (null = unlimited)
  status: BackfillBatchStatus;
  total_leads: number;
  processed_leads: number;
  synced_leads: number;
  skipped_leads: number;
  failed_leads: number;
  current_batch: number;
  // Collection progress fields
  current_campaign_index: number;
  current_campaign_name: string | null;
  total_campaigns: number;
  // Timestamps
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface BackfillLead {
  id: string;
  batch_id: string;
  lead_email: string;
  campaign_id: string;
  campaign_name: string | null;
  status: BackfillLeadStatus;
  instantly_data: any | null;
  determined_event_type: string | null;
  has_reply: boolean;
  pipedrive_org_id: number | null;
  pipedrive_person_id: number | null;
  error_message: string | null;
  retry_count: number;
  collected_at: string;
  completed_at: string | null;
}

export interface CreateBatchOptions {
  campaignIds?: string[];
  dryRun?: boolean;
  batchSize?: number;
  delayMs?: number;
  maxLeadsToCollect?: number; // Limit total leads to collect (for testing)
}

export interface BatchStatusResponse {
  batch: BackfillBatch;
  recentLeads?: BackfillLead[];
  eta?: {
    estimatedMinutesRemaining: number;
    leadsPerMinute: number;
  };
}

export interface LeadFilters {
  status?: BackfillLeadStatus;
  hasError?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedLeads {
  leads: BackfillLead[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ProcessResult {
  batchId: string;
  processed: number;
  synced: number;
  skipped: number;
  failed: number;
  isComplete: boolean;
}

// ============================================================================
// RATE LIMITING CONFIG
// ============================================================================

const RATE_CONFIG = {
  batchSize: 25, // Leads per batch
  batchDelayMs: 5000, // 5 sec between batches
  leadDelayMs: 200, // 200ms between leads
  maxLeadsPerMinute: 120, // Rate limit safety
  collectionBatchSize: 100, // Leads to fetch from Instantly at once
  minDaysCompleted: 10, // Only include leads completed at least this many days ago
  // Instantly API official: 100 req/10sec, 600 req/min
  // But some endpoints may have lower limits (seen 20 req/min on emails endpoint)
  // Using 500ms = 2 req/sec = 120 req/min to be safe
  instantlyApiDelayMs: 500,
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

class InstantlyBackfillService {
  // Note: Using 'any' for Supabase client until database tables are created
  // and TypeScript types are regenerated
  private supabase: any = createServiceRoleClient();

  // ==========================================================================
  // BATCH LIFECYCLE
  // ==========================================================================

  /**
   * Create a new backfill batch
   */
  async createBatch(options: CreateBatchOptions = {}): Promise<BackfillBatch> {
    const {
      campaignIds = [],
      dryRun = false,
      batchSize = RATE_CONFIG.batchSize,
      delayMs = RATE_CONFIG.leadDelayMs,
      maxLeadsToCollect,
    } = options;

    const batchId = `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await this.supabase
      .from('instantly_backfill_batches')
      .insert({
        batch_id: batchId,
        campaign_ids: campaignIds,
        dry_run: dryRun,
        batch_size: batchSize,
        delay_ms: delayMs,
        max_leads_to_collect: maxLeadsToCollect || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create batch:', error);
      throw new Error(`Failed to create batch: ${error.message}`);
    }

    console.log(`✅ Created backfill batch ${batchId}`);
    return data as BackfillBatch;
  }

  /**
   * Collect leads from Instantly and queue them for processing
   */
  async collectLeads(batchId: string): Promise<{ total: number; campaigns: number }> {
    // Get batch info
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Update status to collecting
    await this.updateBatchStatus(batch.id, 'collecting');

    let totalLeads = 0;
    let campaignsProcessed = 0;

    try {
      // Get campaigns to process - ONLY "Algemene mailcampagnes" tag campaigns
      let campaigns = await instantlyClient.listAlgemeneCampagnes();
      console.log(`📋 Found ${campaigns.length} campaigns with "Algemene mailcampagnes" tag`);

      // If specific campaign IDs provided, filter further
      if (batch.campaign_ids && batch.campaign_ids.length > 0) {
        campaigns = campaigns.filter((c) => batch.campaign_ids.includes(c.id));
      }

      console.log(`📋 Collecting leads from ${campaigns.length} campaigns...`);

      // Set total campaigns count in batch
      await this.supabase
        .from('instantly_backfill_batches')
        .update({ total_campaigns: campaigns.length })
        .eq('id', batch.id);

      // Log activity: collection started
      await this.logActivity(batch.id, 'info', `Collection started: ${campaigns.length} campaigns to scan`);

      // Load custom labels for interest status mapping
      const customLabels = await instantlyClient.listLeadLabels();
      const customLabelMap: CustomLabelMap = new Map();
      for (const label of customLabels) {
        if (label.interest_status > 4 || label.interest_status < -4) {
          customLabelMap.set(label.interest_status, {
            label: label.label,
            sentiment: label.interest_status_label,
          });
        }
      }

      // Calculate cutoff date for "completed at least X days ago"
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RATE_CONFIG.minDaysCompleted);
      console.log(`📅 Only including leads completed before ${cutoffDate.toISOString().split('T')[0]} (${RATE_CONFIG.minDaysCompleted}+ days ago)`);

      // Log max leads limit if set
      const maxLeadsLimit = batch.max_leads_to_collect;
      if (maxLeadsLimit) {
        console.log(`🎯 Max leads to collect: ${maxLeadsLimit}`);
      }

      // Create filter function for early stopping during pagination
      const leadFilterFn = (lead: InstantlyLead): boolean => {
        // Check if completed at least X days ago using timestamp_updated
        const updatedAt = lead.timestamp_updated ? new Date(lead.timestamp_updated) : null;
        return !!(updatedAt && updatedAt <= cutoffDate);
      };

      for (const campaign of campaigns) {
        // Check if we've reached the total collection limit
        if (maxLeadsLimit && totalLeads >= maxLeadsLimit) {
          console.log(`\n🎯 Reached collection limit of ${maxLeadsLimit} leads, stopping collection`);
          break;
        }

        const campaignStartTime = Date.now();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📧 Campaign ${campaignsProcessed + 1}/${campaigns.length}: ${campaign.name}`);
        console.log(`   ID: ${campaign.id}`);
        if (maxLeadsLimit) {
          console.log(`   📊 Progress: ${totalLeads}/${maxLeadsLimit} leads collected`);
        }

        // Update collection progress in database for UI
        await this.updateCollectionProgress(batch.id, campaignsProcessed + 1, campaign.name, campaigns.length);

        // Calculate how many more leads we need (if limited)
        const remainingNeeded = maxLeadsLimit ? maxLeadsLimit - totalLeads : undefined;

        // Get only COMPLETED leads from campaign (API-level filter)
        // Uses filterFn for per-page filtering and early stopping
        let eligibleLeads: InstantlyLead[];
        try {
          console.log(`   🔄 Fetching COMPLETED leads from Instantly API (filtering per page)...`);
          const fetchStartTime = Date.now();
          eligibleLeads = await instantlyClient.listLeadsByCampaign(campaign.id, {
            lead_status_filter: InstantlyClient.LEAD_STATUS_FILTER.COMPLETED,
            filterFn: leadFilterFn,
            maxLeads: remainingNeeded, // Stop early if we have enough
          });
          const fetchDuration = Date.now() - fetchStartTime;
          console.log(`   ✅ Fetched ${eligibleLeads.length} eligible leads (${RATE_CONFIG.minDaysCompleted}+ days completed) in ${fetchDuration}ms`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`   ❌ API ERROR: ${errorMsg}`);
          // Update batch with error but continue with next campaign
          await this.supabase
            .from('instantly_backfill_batches')
            .update({
              last_error: `Campaign ${campaign.name}: ${errorMsg}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', batch.id);
          campaignsProcessed++;
          continue;
        }

        const campaignDuration = Date.now() - campaignStartTime;
        console.log(`   ⏱️ Campaign processed in ${campaignDuration}ms`);

        // Skip if no eligible leads
        if (eligibleLeads.length === 0) {
          campaignsProcessed++;
          continue;
        }

        // Queue leads in batches
        for (let i = 0; i < eligibleLeads.length; i += RATE_CONFIG.collectionBatchSize) {
          const leadBatch = eligibleLeads.slice(i, i + RATE_CONFIG.collectionBatchSize);

          const leadsToInsert = await Promise.all(
            leadBatch.map(async (lead) => {
              // Check for auto-reply
              let isAutoReply = false;
              if ((lead.email_reply_count ?? 0) > 0) {
                try {
                  const emails = await instantlyClient.listEmails({
                    lead: lead.email,
                    campaign_id: campaign.id,
                    email_type: 'received',
                    limit: 10,
                  });
                  const hasAutoReplyEmail = emails.items.some((email) => email.is_auto_reply === 1);
                  const hasRealReply = emails.items.some((email) => email.is_auto_reply !== 1);
                  isAutoReply = hasAutoReplyEmail && !hasRealReply;
                } catch {
                  // Ignore auto-reply check failures
                }
              }

              // Determine event type
              const context: LeadStatusContext = {
                source: 'backfill',
                leadStatus:
                  typeof lead.status === 'string' ? parseInt(lead.status, 10) : lead.status,
                interestStatus:
                  typeof lead.interest_status === 'string'
                    ? parseInt(lead.interest_status, 10)
                    : lead.interest_status,
                ltInterestStatus: lead.lt_interest_status,
                replyCount: lead.email_reply_count ?? 0,
                openCount: lead.email_open_count ?? 0,
                clickCount: lead.email_click_count ?? 0,
              };

              const statusResult = determineLeadStatus(context, customLabelMap);
              let eventType = statusResult.syncEventType;
              if (isAutoReply && eventType === 'reply_received') {
                eventType = 'auto_reply_received';
              }

              return {
                batch_id: batch.id,
                lead_email: lead.email.toLowerCase().trim(),
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                status: 'pending' as const,
                instantly_data: lead,
                determined_event_type: eventType,
                has_reply: statusResult.hasReply,
              };
            })
          );

          // Insert leads (with ON CONFLICT handling)
          const { error } = await this.supabase
            .from('instantly_backfill_leads')
            .upsert(leadsToInsert, {
              onConflict: 'batch_id,lead_email,campaign_id',
              ignoreDuplicates: true,
            });

          if (error) {
            console.error('Failed to insert leads batch:', error);
          } else {
            totalLeads += leadBatch.length;
          }

          // Small delay between database insert batches
          await this.delay(100);
        }

        campaignsProcessed++;

        // Delay between campaigns to respect rate limits
        console.log(`   ⏳ Waiting ${RATE_CONFIG.instantlyApiDelayMs}ms before next campaign...`);
        await this.delay(RATE_CONFIG.instantlyApiDelayMs);
      }

      // Update batch with total
      await this.supabase
        .from('instantly_backfill_batches')
        .update({
          total_leads: totalLeads,
          status: 'processing',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', batch.id);

      console.log(`✅ Collected ${totalLeads} leads from ${campaignsProcessed} campaigns`);

      // Log activity: collection completed
      await this.logActivity(batch.id, 'success', `Collection completed: ${totalLeads} leads from ${campaignsProcessed} campaigns`);

      return { total: totalLeads, campaigns: campaignsProcessed };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logActivity(batch.id, 'error', `Collection failed: ${errorMessage}`);
      await this.updateBatchError(batch.id, errorMessage);
      throw error;
    }
  }

  /**
   * Process the next batch of leads
   */
  async processNextBatch(batchId: string): Promise<ProcessResult> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== 'processing') {
      return {
        batchId,
        processed: 0,
        synced: 0,
        skipped: 0,
        failed: 0,
        isComplete: batch.status === 'completed',
      };
    }

    const result: ProcessResult = {
      batchId,
      processed: 0,
      synced: 0,
      skipped: 0,
      failed: 0,
      isComplete: false,
    };

    try {
      // Get next batch of pending leads
      const { data: leads, error } = await this.supabase
        .from('instantly_backfill_leads')
        .select('*')
        .eq('batch_id', batch.id)
        .eq('status', 'pending')
        .order('collected_at', { ascending: true })
        .limit(batch.batch_size);

      if (error) {
        throw new Error(`Failed to fetch leads: ${error.message}`);
      }

      if (!leads || leads.length === 0) {
        // No more pending leads - check if complete
        await this.checkAndMarkComplete(batch.batch_id);
        result.isComplete = true;
        return result;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 PROCESSING BATCH: ${leads.length} leads`);
      console.log(`${'='.repeat(60)}`);

      // Process each lead
      let leadIndex = 0;
      for (const lead of leads) {
        leadIndex++;
        const leadStartTime = Date.now();
        console.log(`\n📧 Lead ${leadIndex}/${leads.length}: ${lead.lead_email}`);
        console.log(`   Campaign: ${lead.campaign_name || lead.campaign_id}`);
        console.log(`   Event Type: ${lead.determined_event_type}`);

        // Mark as processing
        await this.supabase
          .from('instantly_backfill_leads')
          .update({ status: 'processing' })
          .eq('id', lead.id);

        try {
          // Skip if dry run
          if (batch.dry_run) {
            console.log(`   🧪 [DRY RUN] Would sync and delete from Instantly`);
            await this.updateLeadResult(lead.id, batch.id, 'synced', null);
            result.synced++;
            continue;
          }

          // Build lead data from cached Instantly data
          const instantlyData = lead.instantly_data as InstantlyLead;
          const syncResult = await instantlyPipedriveSyncService.syncLeadToPipedrive(
            {
              email: lead.lead_email,
              firstName: instantlyData?.first_name,
              lastName: instantlyData?.last_name,
              companyName: instantlyData?.company_name,
              replyCount: instantlyData?.email_reply_count || 0,
              opensCount: instantlyData?.email_open_count || 0,
              clicksCount: instantlyData?.email_click_count || 0,
            },
            lead.campaign_id,
            lead.campaign_name || 'Unknown Campaign',
            lead.determined_event_type as any,
            'backfill',
            {
              hasReply: lead.has_reply,
              force: true,
            }
          );

          if (syncResult.success) {
            console.log(`   ✅ Synced to Pipedrive (Org: ${syncResult.pipedriveOrgId}, Person: ${syncResult.pipedrivePersonId})`);

            // Delete lead from Instantly after successful sync
            try {
              console.log(`   🗑️ Deleting from Instantly...`);
              const instantlyData = lead.instantly_data as InstantlyLead;
              if (instantlyData?.id) {
                await instantlyClient.deleteLead(instantlyData.id);
                console.log(`   ✅ Deleted from Instantly`);
              } else {
                // Try delete by email if no ID
                await instantlyClient.deleteLeadByEmail(lead.lead_email, lead.campaign_id);
                console.log(`   ✅ Deleted from Instantly (by email)`);
              }
            } catch (deleteError) {
              // Log but don't fail the sync - lead is already synced to Pipedrive
              const deleteErrMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
              console.warn(`   ⚠️ Could not delete from Instantly: ${deleteErrMsg}`);
            }

            await this.updateLeadResult(lead.id, batch.id, 'synced', null, {
              pipedriveOrgId: syncResult.pipedriveOrgId,
              pipedrivePersonId: syncResult.pipedrivePersonId,
            });
            result.synced++;
          } else if (syncResult.skipped) {
            console.log(`   ⏭️ Skipped: ${syncResult.skipReason}`);
            await this.updateLeadResult(lead.id, batch.id, 'skipped', syncResult.skipReason || null);
            result.skipped++;
          } else {
            console.log(`   ❌ Failed: ${syncResult.error}`);
            await this.updateLeadResult(lead.id, batch.id, 'failed', syncResult.error || 'Unknown error');
            result.failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(`   ❌ Error: ${errorMessage}`);
          await this.updateLeadResult(lead.id, batch.id, 'failed', errorMessage);
          result.failed++;
        }

        const leadDuration = Date.now() - leadStartTime;
        console.log(`   ⏱️ Lead processed in ${leadDuration}ms`);
        result.processed++;

        // Rate limiting delay between leads
        await this.delay(batch.delay_ms);
      }

      // Update batch counters
      await this.updateBatchCounters(batch.id);

      // Check if complete
      await this.checkAndMarkComplete(batch.batch_id);

      console.log(
        `✅ Batch complete: ${result.synced} synced, ${result.skipped} skipped, ${result.failed} failed`
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateBatchError(batch.id, errorMessage);
      throw error;
    }
  }

  /**
   * Pause a running batch
   */
  async pauseBatch(batchId: string): Promise<void> {
    const batch = await this.getBatch(batchId);
    if (!batch || batch.status !== 'processing') {
      throw new Error('Batch not found or not in processing state');
    }

    await this.supabase
      .from('instantly_backfill_batches')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    console.log(`⏸️ Paused batch ${batchId}`);
  }

  /**
   * Resume a paused batch
   */
  async resumeBatch(batchId: string): Promise<void> {
    const batch = await this.getBatch(batchId);
    if (!batch || batch.status !== 'paused') {
      throw new Error('Batch not found or not paused');
    }

    await this.supabase
      .from('instantly_backfill_batches')
      .update({
        status: 'processing',
        paused_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    console.log(`▶️ Resumed batch ${batchId}`);
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    await this.supabase
      .from('instantly_backfill_batches')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    console.log(`❌ Cancelled batch ${batchId}`);
  }

  // ==========================================================================
  // STATUS & QUERIES
  // ==========================================================================

  /**
   * Get batch by batch_id (public identifier)
   */
  async getBatch(batchId: string): Promise<BackfillBatch | null> {
    const { data, error } = await this.supabase
      .from('instantly_backfill_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single();

    if (error) return null;
    return data as BackfillBatch;
  }

  /**
   * Get batch status (lightweight or full)
   */
  async getBatchStatus(batchId: string, lightweight = false): Promise<BatchStatusResponse | null> {
    const batch = await this.getBatch(batchId);
    if (!batch) return null;

    const response: BatchStatusResponse = { batch };

    if (!lightweight) {
      // Get recent leads (last 10)
      const { data: recentLeads } = await this.supabase
        .from('instantly_backfill_leads')
        .select('*')
        .eq('batch_id', batch.id)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(10);

      response.recentLeads = (recentLeads || []) as BackfillLead[];
    }

    // Calculate ETA
    if (batch.status === 'processing' && batch.started_at) {
      const elapsed = Date.now() - new Date(batch.started_at).getTime();
      const elapsedMinutes = elapsed / 60000;
      const processedLeads = batch.synced_leads + batch.skipped_leads + batch.failed_leads;

      if (processedLeads > 0 && elapsedMinutes > 0) {
        const leadsPerMinute = processedLeads / elapsedMinutes;
        const remainingLeads = batch.total_leads - processedLeads;
        const estimatedMinutesRemaining = remainingLeads / leadsPerMinute;

        response.eta = {
          estimatedMinutesRemaining: Math.ceil(estimatedMinutesRemaining),
          leadsPerMinute: Math.round(leadsPerMinute * 10) / 10,
        };
      }
    }

    return response;
  }

  /**
   * Get leads for a batch with filters and pagination
   */
  async getLeadStatuses(batchId: string, filters: LeadFilters = {}): Promise<PaginatedLeads> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      return { leads: [], total: 0, page: 1, totalPages: 0 };
    }

    const { status, hasError, search, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    // Build query
    let query = this.supabase
      .from('instantly_backfill_leads')
      .select('*', { count: 'exact' })
      .eq('batch_id', batch.id);

    if (status) {
      query = query.eq('status', status);
    }

    if (hasError) {
      query = query.not('error_message', 'is', null);
    }

    if (search) {
      query = query.or(`lead_email.ilike.%${search}%,campaign_name.ilike.%${search}%`);
    }

    const { data, count, error } = await query
      .order('collected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

    return {
      leads: (data || []) as BackfillLead[],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  /**
   * Get all batches (for dashboard)
   */
  async listBatches(
    options: { limit?: number; status?: BackfillBatchStatus } = {}
  ): Promise<BackfillBatch[]> {
    const { limit = 10, status } = options;

    let query = this.supabase
      .from('instantly_backfill_batches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list batches: ${error.message}`);
    }

    return (data || []) as BackfillBatch[];
  }

  // ==========================================================================
  // RECOVERY
  // ==========================================================================

  /**
   * Retry failed leads
   */
  async retryFailedLeads(batchId: string, leadIds?: string[]): Promise<{ retried: number }> {
    const batch = await this.getBatch(batchId);
    if (!batch) {
      throw new Error('Batch not found');
    }

    // First, get the failed leads we're going to retry
    let selectQuery = this.supabase
      .from('instantly_backfill_leads')
      .select('id, retry_count')
      .eq('batch_id', batch.id)
      .eq('status', 'failed');

    if (leadIds && leadIds.length > 0) {
      selectQuery = selectQuery.in('id', leadIds);
    }

    const { data: failedLeads, error: selectError } = await selectQuery;

    if (selectError) {
      throw new Error(`Failed to fetch failed leads: ${selectError.message}`);
    }

    if (!failedLeads || failedLeads.length === 0) {
      return { retried: 0 };
    }

    // Update each lead with its incremented retry_count
    // Using Promise.all for parallel updates
    const updatePromises = failedLeads.map((lead: { id: string; retry_count: number | null }) =>
      this.supabase
        .from('instantly_backfill_leads')
        .update({
          status: 'pending',
          error_message: null,
          retry_count: (lead.retry_count || 0) + 1,
        })
        .eq('id', lead.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.warn(`${errors.length} leads failed to update for retry`);
    }

    const retriedCount = failedLeads.length - errors.length;

    // Reset batch status if it was completed/failed
    if (batch.status === 'completed' || batch.status === 'failed') {
      await this.supabase
        .from('instantly_backfill_batches')
        .update({
          status: 'processing',
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batch.id);
    }

    // Update counters
    await this.updateBatchCounters(batch.id);

    console.log(`🔄 Retrying ${retriedCount} failed leads`);

    return { retried: retriedCount };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private async updateBatchStatus(id: string, status: BackfillBatchStatus): Promise<void> {
    await this.supabase
      .from('instantly_backfill_batches')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  private async updateBatchError(id: string, errorMessage: string): Promise<void> {
    // First, get current error_count to increment it
    const { data: currentBatch } = await this.supabase
      .from('instantly_backfill_batches')
      .select('error_count')
      .eq('id', id)
      .single();

    const currentErrorCount = currentBatch?.error_count || 0;

    await this.supabase
      .from('instantly_backfill_batches')
      .update({
        status: 'failed',
        last_error: errorMessage,
        error_count: currentErrorCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  private async updateLeadResult(
    leadId: string,
    batchUuid: string,
    status: BackfillLeadStatus,
    errorMessage: string | null,
    pipedriveIds?: { pipedriveOrgId?: number; pipedrivePersonId?: number }
  ): Promise<void> {
    // Update the lead status
    await this.supabase
      .from('instantly_backfill_leads')
      .update({
        status,
        error_message: errorMessage,
        pipedrive_org_id: pipedriveIds?.pipedriveOrgId || null,
        pipedrive_person_id: pipedriveIds?.pipedrivePersonId || null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // Atomically increment the appropriate batch counter
    const counterName = status === 'synced' ? 'synced_leads'
                      : status === 'skipped' ? 'skipped_leads'
                      : status === 'failed' ? 'failed_leads'
                      : null;

    if (counterName) {
      try {
        const { error: counterError } = await this.supabase.rpc('increment_backfill_batch_counter', {
          p_batch_id: batchUuid,
          p_counter_name: counterName,
        });
        if (counterError) {
          console.warn(`Failed to increment ${counterName} counter:`, counterError.message);
        }

        // Also increment processed_leads
        const { error: processedError } = await this.supabase.rpc('increment_backfill_batch_counter', {
          p_batch_id: batchUuid,
          p_counter_name: 'processed_leads',
        });
        if (processedError) {
          console.warn('Failed to increment processed_leads counter:', processedError.message);
        }
      } catch (rpcError) {
        // Don't fail the main operation if counter increment fails
        console.warn('RPC error while incrementing counters:', rpcError);
      }
    }
  }

  private async updateBatchCounters(batchUuid: string): Promise<void> {
    // Verify counters by recounting from lead statuses
    // With atomic increments in updateLeadResult, this is mainly for verification/repair
    const { count: synced } = await this.supabase
      .from('instantly_backfill_leads')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchUuid)
      .eq('status', 'synced');

    const { count: skipped } = await this.supabase
      .from('instantly_backfill_leads')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchUuid)
      .eq('status', 'skipped');

    const { count: failed } = await this.supabase
      .from('instantly_backfill_leads')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchUuid)
      .eq('status', 'failed');

    // Get current batch counters
    const { data: batch } = await this.supabase
      .from('instantly_backfill_batches')
      .select('synced_leads, skipped_leads, failed_leads, processed_leads')
      .eq('id', batchUuid)
      .single();

    const countedTotal = (synced || 0) + (skipped || 0) + (failed || 0);

    // Check for discrepancies
    const hasDiscrepancy = batch && (
      batch.synced_leads !== (synced || 0) ||
      batch.skipped_leads !== (skipped || 0) ||
      batch.failed_leads !== (failed || 0)
    );

    if (hasDiscrepancy) {
      console.warn(`⚠️ Counter discrepancy detected for batch ${batchUuid}:`);
      console.warn(`   Atomic counters: synced=${batch.synced_leads}, skipped=${batch.skipped_leads}, failed=${batch.failed_leads}`);
      console.warn(`   Counted from DB: synced=${synced}, skipped=${skipped}, failed=${failed}`);
      console.warn(`   Repairing counters...`);

      // Repair: update with counted values (they're more reliable)
      await this.supabase
        .from('instantly_backfill_batches')
        .update({
          processed_leads: countedTotal,
          synced_leads: synced || 0,
          skipped_leads: skipped || 0,
          failed_leads: failed || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', batchUuid);
    }
  }

  /**
   * Log activity to the activity log table
   */
  async logActivity(
    batchUuid: string,
    logType: 'info' | 'success' | 'warning' | 'error',
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('instantly_backfill_activity_logs').insert({
        batch_id: batchUuid,
        log_type: logType,
        message,
        metadata: metadata || null,
      });
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.warn('Failed to log activity:', error);
    }
  }

  /**
   * Update collection progress
   */
  private async updateCollectionProgress(
    batchUuid: string,
    campaignIndex: number,
    campaignName: string,
    totalCampaigns: number
  ): Promise<void> {
    await this.supabase
      .from('instantly_backfill_batches')
      .update({
        current_campaign_index: campaignIndex,
        current_campaign_name: campaignName,
        total_campaigns: totalCampaigns,
        updated_at: new Date().toISOString(),
      })
      .eq('id', batchUuid);
  }

  private async checkAndMarkComplete(batchId: string): Promise<void> {
    const batch = await this.getBatch(batchId);
    if (!batch) return;

    // Count pending leads
    const { count: pending } = await this.supabase
      .from('instantly_backfill_leads')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batch.id)
      .eq('status', 'pending');

    if (pending === 0) {
      await this.supabase
        .from('instantly_backfill_batches')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', batch.id);

      // Re-fetch batch to get fresh counter values (updated atomically during processing)
      const freshBatch = await this.getBatch(batchId);

      // Log activity: batch completed (use fresh values)
      await this.logActivity(
        batch.id,
        'success',
        `Batch completed: ${freshBatch?.synced_leads || 0} synced, ${freshBatch?.skipped_leads || 0} skipped, ${freshBatch?.failed_leads || 0} failed`,
        {
          synced: freshBatch?.synced_leads || 0,
          skipped: freshBatch?.skipped_leads || 0,
          failed: freshBatch?.failed_leads || 0,
          total: freshBatch?.total_leads || batch.total_leads,
        }
      );

      console.log(`🎉 Batch ${batchId} completed!`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const instantlyBackfillService = new InstantlyBackfillService();
export { InstantlyBackfillService };
