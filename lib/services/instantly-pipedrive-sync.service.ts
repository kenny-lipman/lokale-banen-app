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
import {
  type StatusKey,
  type InstantlyEventType,
  type QualificationStatus,
  EVENT_CONFIG,
  STATUS_CONFIG,
  getStatusForEvent,
  getQualificationForEvent,
  shouldAddToBlocklist,
  shouldLogActivity,
  shouldUpdateEngagement,
  shouldUpgradeStatus,
  isValidTransition,
  getStatusKey,
  getStatusId,
  getStatusLabel,
  getStatusPriorityById,
  INSTANTLY_EVENT_TYPES,
} from '../constants/status-config';
import {
  determineLeadStatus,
  type LeadStatusContext,
  type LeadStatusResult,
  type EngagementData,
  type CustomLabelMap,
} from './lead-status-determination';
import { postcodeBackfillService } from './postcode-backfill.service';
import { companyEnrichmentService } from './company-enrichment.service';

// ============================================================================
// TYPES
// ============================================================================

// Use the centralized InstantlyEventType as SyncEventType
export type SyncEventType = InstantlyEventType;

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
  hoofddomein?: string; // Platform name based on company postal_code (headquarters)
  subdomeinen?: string[]; // Other platforms where company has job postings
  title?: string; // Job title/function
  linkedinUrl?: string; // LinkedIn profile URL
  // New enrichment fields
  kvkNumber?: string;
  industries?: string[];
  employeeCount?: number;
  jobCategories?: string[]; // Job categories from company's job postings (for branche fallback)
  // Company ID for postcode backfill
  companyId?: string;
  // Instantly data
  replyCount?: number;
  // Engagement data from Instantly
  opensCount?: number;
  clicksCount?: number;
  lastOpenAt?: string;
  lastClickAt?: string;
  lastReplyAt?: string;
  currentStep?: number;
  verificationStatus?: number;
  // Status data from Instantly
  leadStatus?: number; // -1=bounced, -2=unsubscribed, -3=skipped, 0-3=active
  interestStatus?: number;
  ltInterestStatus?: number; // Extended interest status (2=meeting_booked, 4=won)
  // Campaign completion timestamp (when lead finished/left the campaign in Instantly)
  campaignCompletedAt?: string; // ISO date string from Instantly's timestamp_updated
}

export interface SyncOptions {
  hasReply?: boolean;
  replySentiment?: ReplySentiment;
  rawPayload?: any;
  force?: boolean; // Force status update even if protected
  // Engagement data for tracking
  engagementData?: EngagementData;
  // Current Pipedrive status (for transition validation)
  currentPipedriveStatusId?: number;
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
  // Status upgrade tracking (for race condition fix)
  statusUpgraded?: boolean;
  previousStatusId?: number;
  finalPipedriveStatus?: string;
  // Engagement tracking
  engagementUpdated?: boolean;
  blocklistAdded?: boolean;
  qualificationStatus?: QualificationStatus;
  // Blocklist status - if true, lead was already on blocklist and should not be deleted from Instantly
  isBlocklisted?: boolean;
  // Event logged to instantly_email_events
  eventLogged?: boolean;
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
// STATUS MAPPING (Using centralized status-config.ts)
// ============================================================================

/**
 * Map Instantly event types to Pipedrive status prospect keys
 * Now uses the centralized EVENT_CONFIG from status-config.ts
 */
function getStatusKeyForEventLocal(
  eventType: SyncEventType,
  hasReply: boolean,
  replySentiment?: ReplySentiment
): StatusKey | null {
  // First check the centralized config
  const configStatus = getStatusForEvent(eventType);

  // If there's a reply with sentiment, that may override the config
  if (hasReply || eventType === 'reply_received') {
    if (replySentiment === 'negative' || eventType === 'lead_not_interested') {
      return 'NIET_MEER_BENADEREN';
    }
    // Positive or neutral reply
    return 'BENADEREN';
  }

  // Return the configured status for this event type
  return configStatus;
}

/**
 * Get the qualification status for an event type
 */
function getQualificationStatusForEvent(eventType: SyncEventType): QualificationStatus | null {
  return getQualificationForEvent(eventType);
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

      // 2b. Hoofddomein comes from companies table (single source of truth via CompanyEnrichmentService)
      // Campaign name is NOT used as hoofddomein override — it's historical context only
      console.log(`📊 Lead enrichment: company=${enrichedLead.companyName}, hoofddomein=${enrichedLead.hoofddomein}, campaign=${campaignName}`);

      // 2c. Check if email is blocklisted (in our database or Instantly)
      // If blocklisted, we still sync to Pipedrive but force status to NIET_MEER_BENADEREN
      const blocklistCheck = await this.isEmailBlocklisted(cleanEmail);
      const isBlocklisted = blocklistCheck.isBlocked;
      result.isBlocklisted = isBlocklisted;

      // 2d. GATEKEEPER: Ensure postal code exists before Pipedrive sync
      // If no postal code, try on-demand enrichment via Nominatim
      if (!enrichedLead.postalCode && enrichedLead.companyId) {
        console.log(`📍 No postal code for company ${enrichedLead.companyName || enrichedLead.companyId}, attempting on-demand geocoding...`);
        const enrichment = await postcodeBackfillService.enrichCompanyPostcode(enrichedLead.companyId);

        if (enrichment.success && enrichment.postcode) {
          enrichedLead.postalCode = enrichment.postcode;
          console.log(`✅ On-demand geocoding successful: ${enrichment.postcode} (source: ${enrichment.source})`);

          // Update hoofddomein + subdomeinen via CompanyEnrichmentService (single source of truth)
          const platformResult = await companyEnrichmentService.updateCompanyPlatforms(enrichedLead.companyId!);
          enrichedLead.hoofddomein = platformResult.hoofddomein || undefined;
          enrichedLead.subdomeinen = platformResult.subdomeinen;
          console.log(`📍 Updated platforms: hoofddomein=${platformResult.hoofddomein}, subdomeinen=[${platformResult.subdomeinen.join(', ')}]`);
        } else {
          // HARD BLOCK: Cannot sync to Pipedrive without postal code
          console.log(`🚫 Cannot sync to Pipedrive: No postal code for ${cleanEmail} (company: ${enrichedLead.companyName || enrichedLead.companyId})`);
          result.skipped = true;
          result.skipReason = 'no_postal_code';
          result.error = 'Company has no postal code - queued for geocoding';
          return result;
        }
      } else if (!enrichedLead.postalCode && !enrichedLead.companyId) {
        // No company ID means we can't geocode — allow sync but hoofddomein may be null
        console.log(`⚠️ No company ID for ${cleanEmail}, hoofddomein: ${enrichedLead.hoofddomein || 'unknown'}`);
      }

      // 3. Determine the status to set (using centralized config)
      // If blocklisted, always use NIET_MEER_BENADEREN regardless of event type
      let statusKey: StatusKey | null;
      if (isBlocklisted) {
        statusKey = 'NIET_MEER_BENADEREN';
        console.log(`🚫 Email ${cleanEmail} is blocklisted (${blocklistCheck.source}: ${blocklistCheck.reason}) - forcing status to NIET_MEER_BENADEREN`);
      } else {
        statusKey = getStatusKeyForEventLocal(
          eventType,
          options.hasReply || false,
          options.replySentiment
        );
      }

      // Get qualification status for this event
      const qualificationStatus = getQualificationStatusForEvent(eventType);
      result.qualificationStatus = qualificationStatus ?? undefined;

      // Check if this is an engagement-only event (no status change needed)
      const isEngagementOnly = statusKey === null && EVENT_CONFIG[eventType]?.updateEngagement;

      if (!statusKey && !isEngagementOnly) {
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

        // 7. Set Hoofddomein if available (based on company postal code)
        if (enrichedLead.hoofddomein) {
          const hoofddomeinResult = await this.pipedriveClient.setOrganizationHoofddomein(
            orgResult.id,
            enrichedLead.hoofddomein
          );
          if (!hoofddomeinResult.success) {
            console.warn(`⚠️ Could not set Hoofddomein: ${hoofddomeinResult.reason}`);
          }
        }

        // 7b. Set Subdomeinen if available (from companies table, single source of truth)
        // IMPORTANT: Always filter out hoofddomein from subdomeinen to prevent duplicates
        const rawSubdomeinen = enrichedLead.subdomeinen || [];
        const subdomeinen = enrichedLead.hoofddomein
          ? rawSubdomeinen.filter(s => s !== enrichedLead.hoofddomein)
          : rawSubdomeinen;

        if (subdomeinen.length > 0) {
          const subdomeinResult = await this.pipedriveClient.setOrganizationSubdomein(
            orgResult.id,
            subdomeinen
          );
          if (!subdomeinResult.success) {
            console.warn(`⚠️ Could not set Subdomeinen: ${subdomeinResult.reason}`);
          }
        }

        // 8. Update organization with enrichment data (website, address)
        await this.updateOrganizationEnrichment(orgResult.id, enrichedLead);

        // 8b. Set "Start Pipedrive" date (when lead left the Instantly campaign)
        // Always set this, regardless of whether org is new or existing
        await this.setOrganizationStartPipedriveDate(orgResult.id, enrichedLead.campaignCompletedAt);

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
      // EXCEPTIONS:
      // - For campaign_completed/backfill: delay removal by 10 days to catch late replies
      // - For blocklisted emails: DO NOT remove from Instantly (they should stay on blocklist there)
      if (isBlocklisted) {
        // Blocklisted email: do NOT remove from Instantly
        // The email is already on blocklist (either in our DB or Instantly) and should stay there
        console.log(`🚫 Blocklisted email ${cleanEmail} - NOT removing from Instantly (keeping on blocklist)`);
        result.instantlyLeadRemoved = false;
      } else if (eventType === 'campaign_completed' || eventType === 'backfill') {
        // Store campaign_completed_at timestamp for delayed removal (10 days)
        await this.setCampaignCompletedAt(cleanEmail, contactData?.id);
        console.log(`⏳ Campaign completed for ${cleanEmail} - will be removed from Instantly after 10 days`);
        result.instantlyLeadRemoved = false;
      } else {
        // Immediate removal for all other events
        const removeResult = await this.removeLeadFromInstantly(cleanEmail, campaignId, contactData?.id);
        if (removeResult.removed) {
          result.instantlyLeadRemoved = true;
          console.log(`🗑️ Removed lead ${cleanEmail} from Instantly after Pipedrive sync`);
        } else if (removeResult.error) {
          console.warn(`⚠️ Could not remove lead from Instantly: ${removeResult.error}`);
        }
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
   * Now handles ALL event types using centralized status-config.ts
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

    // Use centralized determineLeadStatus for consistent handling
    const statusContext: LeadStatusContext = {
      source: 'webhook',
      eventType: syncEventType,
    };
    const statusResult = determineLeadStatus(statusContext);

    const hasReply = statusResult.hasReply;
    const replySentiment = statusResult.replySentiment;

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

    // Log the event to instantly_email_events table for analytics
    await this.logInstantlyEvent(lead_email, campaign_id, campaign_name, syncEventType, payload);

    // Handle engagement-only events separately
    if (statusResult.shouldUpdateEngagement && !statusResult.pipedriveStatus) {
      // Update engagement metrics in Supabase
      await this.updateContactEngagement(lead_email, syncEventType);
      return {
        success: true,
        leadEmail: lead_email,
        campaignId: campaign_id,
        campaignName: campaign_name,
        orgCreated: false,
        personCreated: false,
        skipped: false,
        engagementUpdated: true,
        eventLogged: true
      };
    }

    // Handle blocklist events
    if (statusResult.shouldAddToBlocklist) {
      const { data: contactData } = await this.supabase
        .from('contacts')
        .select('id, company_id')
        .eq('email', lead_email.toLowerCase().trim())
        .single();

      await this.createBlocklistEntry(
        lead_email,
        syncEventType === 'email_bounced' ? 'Email bounced' :
        syncEventType === 'lead_unsubscribed' ? 'Unsubscribed (GDPR)' :
        syncEventType === 'lead_not_interested' ? 'Not interested' :
        'Blocklist event',
        contactData?.id,
        contactData?.company_id
      );
    }

    return this.syncLeadToPipedrive(
      {
        email: lead_email,
        // Use the webhook timestamp as campaign completion date
        // For campaign_completed events, this is when the lead left the campaign
        campaignCompletedAt: payload.timestamp,
      },
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
   * Now supports ALL Instantly event types from status-config.ts
   */
  private mapWebhookEventToSyncEvent(
    webhookEventType: InstantlyWebhookEventType | string
  ): SyncEventType | null {
    // Check if this is a known event type from our centralized config
    if (INSTANTLY_EVENT_TYPES.includes(webhookEventType as InstantlyEventType)) {
      return webhookEventType as SyncEventType;
    }

    // Legacy mapping for backwards compatibility
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
        console.warn(`⚠️ Unknown webhook event type: ${webhookEventType}`);
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
      maxLeads?: number;
      timeLimitMs?: number;
      timeLimitStartedAt?: number;
    } = {}
  ): Promise<{
    total: number;
    synced: number;
    skipped: number;
    errors: number;
    results: SyncResult[];
    stoppedEarly: boolean;
  }> {
    const { dryRun = false, batchSize = 50, skipExisting = true, maxLeads, timeLimitMs, timeLimitStartedAt } = options;
    const results: SyncResult[] = [];
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let stoppedEarly = false;

    console.log(`🔄 Starting backfill for campaign ${campaignId}...`);

    // Load custom labels for mapping lt_interest_status to custom label events
    console.log(`📋 Loading custom labels...`);
    const customLabels = await this.instantlyClient.listLeadLabels();
    const customLabelMap: CustomLabelMap = new Map();

    for (const label of customLabels) {
      // Custom labels have interest_status values outside standard range (-4 to 4)
      // Standard values: 0=OOO, 1=interested, 2=meeting_booked, 3=meeting_completed, 4=won, -1=not_interested, -2=wrong_person, -3=lost, -4=no_show
      if (label.interest_status > 4 || label.interest_status < -4) {
        customLabelMap.set(label.interest_status, {
          label: label.label,
          sentiment: label.interest_status_label
        });
      }
    }
    console.log(`📋 Loaded ${customLabelMap.size} custom labels`);

    // Get campaign info
    const campaign = await this.instantlyClient.getCampaign(campaignId);
    const campaignName = campaign?.name || 'Unknown Campaign';

    // Get leads for the campaign (optionally limited)
    const leads = await this.instantlyClient.listLeadsByCampaign(campaignId, {
      ...(maxLeads ? { maxLeads } : {})
    });
    console.log(`📊 Found ${leads.length} leads in campaign${maxLeads ? ` (limited to ${maxLeads})` : ''}`);

    // Process leads in batches
    for (let i = 0; i < leads.length && !stoppedEarly; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

      for (const lead of batch) {
        // Check time limit before processing each lead
        if (timeLimitMs && timeLimitStartedAt) {
          const elapsed = Date.now() - timeLimitStartedAt;
          if (elapsed >= timeLimitMs) {
            stoppedEarly = true;
            console.log(`⏱️ Time limit reached (${Math.round(elapsed / 1000)}s). Stopping early — ${synced} synced, ${skipped} skipped so far.`);
            break;
          }
        }

        // Check for auto-reply if lead has replies
        let isAutoReply = false;
        if ((lead.email_reply_count ?? 0) > 0) {
          try {
            const emails = await this.instantlyClient.listEmails({
              lead: lead.email,
              campaign_id: campaignId,
              email_type: 'received',
              limit: 10
            });
            const hasAutoReplyEmail = emails.items.some(email => email.is_auto_reply === 1);
            const hasRealReply = emails.items.some(email => email.is_auto_reply !== 1);
            isAutoReply = hasAutoReplyEmail && !hasRealReply;
          } catch (error) {
            console.warn(`Could not check auto-reply for ${lead.email}:`, error);
          }
        }

        // Determine event type and sentiment based on Instantly lead data
        // Now includes custom label mapping and auto-reply detection
        const { eventType, hasReply, replySentiment, engagementData } = this.determineBackfillEventType(
          lead,
          customLabelMap,
          isAutoReply
        );

        // Skip if already synced — check both exact match AND cross-campaign
        if (skipExisting) {
          // First: exact match (same email + campaign + event type)
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

          // Second: cross-campaign check — prevent duplicate Pipedrive entries
          // when the same email was already synced via a different campaign
          const previousSync = await this.hasEverBeenSynced(lead.email);
          if (previousSync) {
            skipped++;
            results.push({
              success: false,
              leadEmail: lead.email,
              campaignId,
              campaignName,
              orgCreated: false,
              personCreated: false,
              skipped: true,
              skipReason: `Already synced via campaign "${previousSync.campaignName}"`
            });
            continue;
          }
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would sync: ${lead.email} as ${eventType} (hasReply: ${hasReply}, sentiment: ${replySentiment}, engagement: opens=${engagementData?.opensCount || 0}, clicks=${engagementData?.clicksCount || 0})`);
          synced++;
          continue;
        }

        // Sync the lead with the correct event type, sentiment, and engagement data
        const result = await this.syncLeadToPipedrive(
          {
            email: lead.email,
            firstName: lead.first_name,
            lastName: lead.last_name,
            companyName: lead.company_name,
            replyCount: lead.email_reply_count || 0,
            // Include engagement data from Instantly
            opensCount: lead.email_open_count || 0,
            clicksCount: lead.email_click_count || 0,
            lastOpenAt: (lead as any).timestamp_last_open,
            lastClickAt: (lead as any).timestamp_last_click,
            lastReplyAt: (lead as any).timestamp_last_reply,
            currentStep: (lead as any).sequence_step,
            verificationStatus: (lead as any).verification_status,
            // Status data from Instantly
            leadStatus: typeof lead.status === 'string' ? parseInt(lead.status, 10) : lead.status,
            interestStatus: typeof lead.interest_status === 'string' ? parseInt(lead.interest_status, 10) : lead.interest_status,
            ltInterestStatus: (lead as any).lt_interest_status,
          },
          campaignId,
          campaignName,
          eventType,
          'backfill',
          {
            hasReply,
            replySentiment,
            engagementData
          }
        );

        // Store engagement metrics even for backfill if we have data
        if (engagementData && (engagementData.opensCount > 0 || engagementData.clicksCount > 0)) {
          await this.storeBackfillEngagementMetrics(lead.email, engagementData);
        }

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

    console.log(`${stoppedEarly ? '⏱️' : '✅'} Backfill ${stoppedEarly ? 'paused (time limit)' : 'complete'}: ${synced} synced, ${skipped} skipped, ${errors} errors`);

    return {
      total: leads.length,
      synced,
      skipped,
      errors,
      results,
      stoppedEarly,
    };
  }

  /**
   * Determine the correct event type and sentiment for backfill based on Instantly lead data
   * Now uses the unified determineLeadStatus function for consistent handling
   *
   * Instantly lead statuses:
   * - status: -1 = bounced, -2 = unsubscribed, -3 = skipped, 0-3 = active
   * - email_reply_count > 0: Lead has replied
   * - interest_status: 1 = interested, -1 = not interested
   * - lt_interest_status: 0=OOO, 1=interested, 2=meeting_booked, 3=meeting_completed, 4=won, -1=not_interested, -2=wrong_person, -3=lost, -4=no_show
   *
   * @param lead - The Instantly lead data
   * @param customLabelMap - Optional map of custom labels for interest_status values outside standard range
   * @param isAutoReply - Optional flag indicating if the lead only has auto-replies
   */
  private determineBackfillEventType(
    lead: InstantlyLead,
    customLabelMap?: CustomLabelMap,
    isAutoReply?: boolean
  ): {
    eventType: SyncEventType;
    hasReply: boolean;
    replySentiment?: ReplySentiment;
    engagementData?: EngagementData;
  } {
    // Build context for unified determination
    const context: LeadStatusContext = {
      source: 'backfill',
      leadStatus: typeof lead.status === 'string' ? parseInt(lead.status, 10) : lead.status,
      interestStatus: typeof lead.interest_status === 'string'
        ? parseInt(lead.interest_status, 10)
        : lead.interest_status,
      ltInterestStatus: lead.lt_interest_status,
      replyCount: lead.email_reply_count ?? 0,
      openCount: lead.email_open_count ?? 0,
      clickCount: lead.email_click_count ?? 0,
      timestampLastReply: lead.timestamp_last_reply,
      timestampLastOpen: lead.timestamp_last_open,
      timestampLastClick: lead.timestamp_last_click,
    };

    // Use unified determination with custom label map
    const result = determineLeadStatus(context, customLabelMap);

    // Override with auto_reply_received if lead only has auto-replies
    if (isAutoReply && result.syncEventType === 'reply_received') {
      return {
        eventType: 'auto_reply_received',
        hasReply: true,
        replySentiment: 'neutral',
        engagementData: result.engagementData
      };
    }

    return {
      eventType: result.syncEventType,
      hasReply: result.hasReply,
      replySentiment: result.replySentiment,
      engagementData: result.engagementData
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
      maxLeadsPerCampaign?: number;
      timeLimitMs?: number;
      timeLimitStartedAt?: number;
    } = {}
  ): Promise<{
    campaigns: number;
    totalLeads: number;
    synced: number;
    skipped: number;
    errors: number;
    stoppedEarly: boolean;
  }> {
    let totalLeads = 0;
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let stoppedEarly = false;

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
      // Check time limit before starting next campaign
      if (options.timeLimitMs && options.timeLimitStartedAt) {
        const elapsed = Date.now() - options.timeLimitStartedAt;
        if (elapsed >= options.timeLimitMs) {
          stoppedEarly = true;
          console.log(`⏱️ Time limit reached before campaign ${campaign.name}. Stopping.`);
          break;
        }
      }

      console.log(`\n📧 Processing campaign: ${campaign.name}`);

      const result = await this.backfillCampaign(campaign.id, {
        dryRun: options.dryRun,
        skipExisting: true,
        maxLeads: options.maxLeadsPerCampaign,
        timeLimitMs: options.timeLimitMs,
        timeLimitStartedAt: options.timeLimitStartedAt,
      });

      totalLeads += result.total;
      synced += result.synced;
      skipped += result.skipped;
      errors += result.errors;

      if (result.stoppedEarly) {
        stoppedEarly = true;
        break;
      }
    }

    return {
      campaigns: campaigns.length,
      totalLeads,
      synced,
      skipped,
      errors,
      stoppedEarly,
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
   * Check if a lead email has EVER been synced to Pipedrive (any campaign, any event type).
   * Used during backfill to prevent duplicate Pipedrive entries when the same email
   * exists in multiple campaigns or was previously synced under a different campaign_id.
   */
  async hasEverBeenSynced(
    email: string
  ): Promise<{ id: string; campaignName: string } | null> {
    const { data, error } = await this.supabase
      .from('instantly_pipedrive_syncs')
      .select('id, instantly_campaign_name')
      .eq('instantly_lead_email', email.toLowerCase().trim())
      .limit(1)
      .single();

    if (error || !data) return null;
    return { id: data.id, campaignName: data.instantly_campaign_name };
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

  // ============================================================================
  // DELAYED INSTANTLY CLEANUP
  // ============================================================================

  /**
   * Clean up leads from Instantly that had campaign_completed more than X days ago
   * This is called by a daily cron job to remove stale leads while giving them
   * time to reply late (default: 10 days)
   */
  async cleanupCompletedCampaignLeads(daysDelay: number = 10, batchSize: number = 100): Promise<{
    processed: number;
    removed: number;
    errors: number;
    skipped: number;
    totalEligible: number;
    remaining: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysDelay);

    console.log(`🧹 Starting cleanup of completed campaign leads (cutoff: ${cutoffDate.toISOString()})`);

    // First, count total eligible leads to know if there are more than we'll process
    const { count: totalEligible, error: countError } = await this.supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .not('instantly_campaign_completed_at', 'is', null)
      .is('instantly_removed_at', null)
      .lt('instantly_campaign_completed_at', cutoffDate.toISOString())
      .in('instantly_status', ['campaign_completed', 'backfill']);

    if (countError) {
      console.error('Error counting leads for cleanup:', countError);
    }

    const totalCount = totalEligible || 0;
    console.log(`📊 Total eligible leads for cleanup: ${totalCount}`);

    // Find contacts that:
    // - Have campaign_completed_at set
    // - campaign_completed_at is older than cutoff date
    // - instantly_removed_at is NULL (not yet removed)
    // - No reply received since campaign completed (check instantly_status)
    const { data: leadsToCleanup, error } = await this.supabase
      .from('contacts')
      .select('id, email, instantly_campaign_completed_at, instantly_status, instantly_campaign_ids')
      .not('instantly_campaign_completed_at', 'is', null)
      .is('instantly_removed_at', null)
      .lt('instantly_campaign_completed_at', cutoffDate.toISOString())
      .in('instantly_status', ['campaign_completed', 'backfill']) // Only those still in completed state
      .order('instantly_campaign_completed_at', { ascending: true }) // Process oldest first
      .limit(batchSize);

    if (error) {
      console.error('Error fetching leads for cleanup:', error);
      return { processed: 0, removed: 0, errors: 1, skipped: 0, totalEligible: totalCount, remaining: totalCount };
    }

    if (!leadsToCleanup || leadsToCleanup.length === 0) {
      console.log('✅ No leads to clean up');
      return { processed: 0, removed: 0, errors: 0, skipped: 0, totalEligible: 0, remaining: 0 };
    }

    console.log(`📋 Processing ${leadsToCleanup.length} of ${totalCount} eligible leads (batch size: ${batchSize})`);

    let processed = 0;
    let removed = 0;
    let errors = 0;
    let skipped = 0;

    for (const contact of leadsToCleanup) {
      processed++;

      try {
        // Double-check: has this lead replied since campaign completed?
        // Check if there's a newer sync event with reply for this email
        // Note: Using 'any' cast to avoid TS2589 "Type instantiation is excessively deep" with Supabase types
        const { data: replyCheck } = await (this.supabase as any)
          .from('instantly_pipedrive_syncs')
          .select('id')
          .eq('lead_email', contact.email!.toLowerCase())
          .eq('has_reply', true)
          .gt('created_at', contact.instantly_campaign_completed_at!)
          .limit(1) as { data: { id: string }[] | null };

        if (replyCheck && replyCheck.length > 0) {
          console.log(`⏭️ Skipping ${contact.email} - has replied since campaign completed`);
          skipped++;
          continue;
        }

        // Get campaign ID from the array (use first one if multiple)
        const campaignId = contact.instantly_campaign_ids?.[0];

        // Remove from Instantly
        const removeResult = await this.removeLeadFromInstantly(
          contact.email,
          campaignId || '',
          contact.id
        );

        if (removeResult.removed) {
          removed++;
          console.log(`🗑️ Cleaned up ${contact.email} from Instantly (campaign completed ${daysDelay}+ days ago)`);
        } else {
          // Still mark as processed even if not found in Instantly
          console.log(`ℹ️ ${contact.email} not found in Instantly (may have been removed already)`);

          // Update the contact to mark as cleaned up
          await this.supabase
            .from('contacts')
            .update({
              instantly_removed_at: new Date().toISOString(),
              qualification_status: 'synced_to_pipedrive'
            })
            .eq('id', contact.id);

          removed++;
        }
      } catch (err) {
        console.error(`Error cleaning up ${contact.email}:`, err);
        errors++;
      }
    }

    const remaining = Math.max(0, totalCount - processed);

    console.log(`✅ Cleanup complete: ${processed} processed, ${removed} removed, ${skipped} skipped, ${errors} errors`);

    if (remaining > 0) {
      console.log(`⚠️ ${remaining} leads remaining for next run (total eligible: ${totalCount})`);
    }

    return { processed, removed, errors, skipped, totalEligible: totalCount, remaining };
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
   * to get additional data like company info, Hoofddomein (based on postal code)
   * and Subdomeinen (other platforms where company has job postings)
   */
  async getEnrichmentDataByEmail(email: string): Promise<{
    contact?: {
      id: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      title?: string;
      linkedinUrl?: string;
    };
    company?: {
      id: string;
      name?: string;
      website?: string;
      phone?: string;
      city?: string;
      streetAddress?: string;
      postalCode?: string;
      kvkNumber?: string;
      industries?: string[];
      employeeCount?: number;
    };
    hoofddomein?: string;
    subdomeinen?: string[];
    jobCategories?: string[];
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
          linkedin_url,
          company_id,
          companies (
            id,
            name,
            website,
            phone,
            city,
            street_address,
            postal_code,
            kvk,
            industries,
            apollo_employees_estimate,
            hoofddomein,
            subdomeinen
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

      // Read Hoofddomein and Subdomeinen from companies table (single source of truth)
      // If hoofddomein is null but postal_code exists, CompanyEnrichmentService will compute it
      let hoofddomein: string | null = company?.hoofddomein || null;
      let subdomeinen: string[] = company?.subdomeinen || [];

      if (!hoofddomein && company?.id && company?.postal_code) {
        // Auto-compute missing hoofddomein
        const platforms = await companyEnrichmentService.getCompanyPlatforms(company.id);
        hoofddomein = platforms.hoofddomein;
        subdomeinen = platforms.subdomeinen;
      }

      // Get job categories for branche fallback (if company doesn't have Apollo industries)
      let jobCategories: string[] = [];
      if (company?.id) {
        const { data: jobCats } = await this.supabase
          .from('job_postings')
          .select('categories')
          .eq('company_id', company.id)
          .not('categories', 'is', null)
          .neq('categories', '')
          .neq('categories', 'Overig')
          .limit(10);

        if (jobCats && jobCats.length > 0) {
          const allCategories = jobCats.flatMap(j => j.categories?.split(', ') || []);
          jobCategories = [...new Set(allCategories)].filter(c => c && c !== 'Overig');
        }
      }

      console.log(`✅ Found enrichment data for ${cleanEmail}: company=${company?.name}, hoofddomein=${hoofddomein}, subdomeinen=[${subdomeinen.join(', ')}], jobCategories=[${jobCategories.join(', ')}]`);

      return {
        contact: {
          id: contact.id,
          firstName: contact.first_name || undefined,
          lastName: contact.last_name || undefined,
          phone: contact.phone || undefined,
          title: contact.title || undefined,
          linkedinUrl: contact.linkedin_url || undefined
        },
        company: company ? {
          id: company.id,
          name: company.name || undefined,
          website: company.website || undefined,
          phone: company.phone || undefined,
          city: company.city || undefined,
          streetAddress: company.street_address || undefined,
          postalCode: company.postal_code || undefined,
          kvkNumber: company.kvk || undefined,
          industries: company.industries || undefined,
          employeeCount: company.apollo_employees_estimate || undefined
        } : undefined,
        hoofddomein: hoofddomein || undefined,
        subdomeinen,
        jobCategories
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
      subdomeinen: lead.subdomeinen || enrichment.subdomeinen,
      title: lead.title || enrichment.contact?.title,
      linkedinUrl: lead.linkedinUrl || enrichment.contact?.linkedinUrl,
      // New enrichment fields
      kvkNumber: lead.kvkNumber || enrichment.company?.kvkNumber,
      industries: lead.industries || enrichment.company?.industries,
      employeeCount: lead.employeeCount || enrichment.company?.employeeCount,
      jobCategories: lead.jobCategories || enrichment.jobCategories,
      // Company ID for postcode backfill
      companyId: lead.companyId || enrichment.company?.id,
      replyCount: lead.replyCount
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  // Pipedrive custom field IDs
  private static readonly PIPEDRIVE_FIELDS = {
    ORGANIZATION_WEBSITE: '79f6688e77fed7099077425e7f956d52aaa9defb',
    ORGANIZATION_PHONE: 'f249147e63f82da820824528364fe2cc8fb86482',
    ORGANIZATION_KVK: '1e887677c33f2cd084eb85a4bf421b657e7ba154',
    ORGANIZATION_BRANCHE: '75a7b46357970b58a7c5f9763ddcd23a5806e108',
    ORGANIZATION_SIZE: 'f68e60517a23efa9a0d9defa762c534bb7cbfc46',
    /** "Einde Instantly campg. Start Pipedrive NIET AANKOMEN" - Date when lead moves to Pipedrive */
    ORGANIZATION_START_PIPEDRIVE_DATE: 'ea203acb05edaece965736651111cb1aefe83f3b',
    PERSON_FUNCTIE: 'eff8a3361f8ec8bc1c3edc57b170019bdf9d99f3',
    PERSON_LINKEDIN: '275274fd29282c0679a1e84e7cef010dba5513b0'
  };

  // Pipedrive Branche enum options
  private static readonly BRANCHE_OPTIONS: Record<string, number> = {
    'Automotive': 53,
    'Bouw + gerelateerd': 54,
    'Detailhandel, groothandel en ambachten': 55,
    'Horeca & Toerisme': 56,
    'Industrie & Productie': 58,
    'Leisure': 59,
    'Logistiek & Transport': 60,
    'Overheid/gemeente': 61,
    'Tuinbouw/Sierteelt': 62,
    'Voedselbranche': 64,
    'Zakelijke en persoonlijke dienstverlening': 66,
    'Zorg + onderwijs': 67
  };

  // Pipedrive Bedrijfsgrootte enum options
  private static readonly SIZE_OPTIONS = {
    KLEIN: 222,   // < 10
    MIDDEL: 223,  // < 100
    GROOT: 224    // > 100
  };

  // Job category to Branche mapping (Dutch job categories from job_postings.categories)
  private static readonly JOB_CATEGORY_TO_BRANCHE: Record<string, number> = {
    'Medisch/Zorg': 67,
    'Onderwijs/Onderzoek/Wetenschap': 67,
    'Inkoop/Logistiek/Transport': 60,
    'Techniek': 58,
    'Productie/Uitvoerend': 58,
    'Horeca/Detailhandel': 56,
    'Financieel/Accounting': 66,
    'Commercieel/Verkoop': 66,
    'Administratief/Secretarieel': 66,
    'Automatisering/Internet': 66,
    'HR/Training/Opleiding': 66,
    'Consultancy/Advies': 66,
    'Klantenservice/Callcenter/Receptie': 66,
    'Beleid/Bestuur/Staf': 66,
    'Marketing/PR/Communicatie': 66,
    'Financiele dienstverlening': 66,
    'Juridisch': 66,
    'Beveiliging/Defensie/Politie': 61,
    'Design/Creatie/Journalistiek': 59,
    'Directie/Management algemeen': 66,
  };

  // Branche options list for AI detection
  private static readonly BRANCHE_OPTIONS_LIST = [
    { id: 53, name: 'Automotive' },
    { id: 54, name: 'Bouw + gerelateerd' },
    { id: 55, name: 'Detailhandel, groothandel en ambachten' },
    { id: 56, name: 'Horeca & Toerisme' },
    { id: 58, name: 'Industrie & Productie' },
    { id: 59, name: 'Leisure' },
    { id: 60, name: 'Logistiek & Transport' },
    { id: 61, name: 'Overheid/gemeente' },
    { id: 62, name: 'Tuinbouw/Sierteelt' },
    { id: 64, name: 'Voedselbranche' },
    { id: 66, name: 'Zakelijke en persoonlijke dienstverlening' },
    { id: 67, name: 'Zorg + onderwijs' },
  ];

  /**
   * Map employee count to Pipedrive size enum
   */
  private static mapEmployeeCountToSize(count: number): number | null {
    if (count < 10) return InstantlyPipedriveSyncService.SIZE_OPTIONS.KLEIN;
    if (count < 100) return InstantlyPipedriveSyncService.SIZE_OPTIONS.MIDDEL;
    return InstantlyPipedriveSyncService.SIZE_OPTIONS.GROOT;
  }

  /**
   * Map industries array to Pipedrive Branche enum using keyword matching
   * Falls back to AI mapping if no direct match found
   */
  private static mapIndustriesToBranche(industries: string[]): number | null {
    if (!industries || industries.length === 0) return null;

    // Filter out null/undefined values that may come from enrichment data
    const validIndustries = industries.filter((i): i is string => typeof i === 'string');
    if (validIndustries.length === 0) return null;

    const industriesLower = validIndustries.map(i => i.toLowerCase()).join(' ');

    // Keyword-based mapping (ordered by specificity)
    const mappings: Array<{ keywords: string[]; branche: number }> = [
      { keywords: ['automotive', 'car', 'vehicle', 'auto'], branche: 53 },
      { keywords: ['construction', 'bouw', 'building', 'architect'], branche: 54 },
      { keywords: ['retail', 'wholesale', 'detailhandel', 'groothandel', 'shop', 'store', 'winkel'], branche: 55 },
      { keywords: ['hotel', 'restaurant', 'horeca', 'tourism', 'toerisme', 'hospitality', 'catering'], branche: 56 },
      { keywords: ['manufacturing', 'industrial', 'productie', 'industrie', 'factory', 'fabriek'], branche: 58 },
      { keywords: ['leisure', 'entertainment', 'recreation', 'sport', 'fitness', 'gaming'], branche: 59 },
      { keywords: ['logistics', 'transport', 'shipping', 'freight', 'warehouse', 'logistiek', 'vervoer'], branche: 60 },
      { keywords: ['government', 'overheid', 'gemeente', 'public sector', 'municipality'], branche: 61 },
      { keywords: ['agriculture', 'tuinbouw', 'horticulture', 'farming', 'plants', 'greenhouse', 'sierteelt', 'kwekerij'], branche: 62 },
      { keywords: ['food', 'voedsel', 'beverage', 'bakery', 'bakkerij', 'grocery', 'supermarket'], branche: 64 },
      { keywords: ['consulting', 'services', 'dienstverlening', 'advisory', 'accounting', 'legal', 'hr', 'recruitment', 'staffing', 'cleaning', 'schoonmaak'], branche: 66 },
      { keywords: ['healthcare', 'medical', 'zorg', 'hospital', 'clinic', 'education', 'onderwijs', 'school', 'university', 'training'], branche: 67 },
    ];

    for (const mapping of mappings) {
      if (mapping.keywords.some(kw => industriesLower.includes(kw))) {
        return mapping.branche;
      }
    }

    return null; // No match found
  }

  /**
   * Map job categories to Pipedrive Branche enum
   * Uses the most common branche from the categories
   */
  private static mapJobCategoriesToBranche(categories: string[]): number | null {
    if (!categories || categories.length === 0) return null;

    const brancheCounts = new Map<number, number>();
    for (const category of categories) {
      const branche = InstantlyPipedriveSyncService.JOB_CATEGORY_TO_BRANCHE[category];
      if (branche) {
        brancheCounts.set(branche, (brancheCounts.get(branche) || 0) + 1);
      }
    }

    if (brancheCounts.size === 0) return null;

    // Return most common branche
    let maxCount = 0;
    let mostCommon: number | null = null;
    for (const [branche, count] of brancheCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = branche;
      }
    }
    return mostCommon;
  }

  /**
   * Determine branche using AI (Mistral) based on company name
   * This is the third tier fallback when Apollo industries and job categories are not available
   */
  private async determineBrancheWithAI(companyName: string): Promise<number | null> {
    try {
      const brancheList = InstantlyPipedriveSyncService.BRANCHE_OPTIONS_LIST
        .map(b => `${b.id}: ${b.name}`)
        .join('\n');

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{
            role: 'user',
            content: `Bepaal de branche voor dit Nederlandse bedrijf.

Bedrijfsnaam: "${companyName}"

Kies de BESTE match uit deze opties:
${brancheList}

Antwoord ALLEEN met het branche nummer (bijv. "67"). Als je het niet zeker weet, antwoord "null".`
          }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        console.warn(`⚠️ AI branche API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content?.trim();

      if (answer === 'null' || !answer) return null;

      const brancheId = parseInt(answer, 10);
      const validIds = InstantlyPipedriveSyncService.BRANCHE_OPTIONS_LIST.map(b => b.id);

      if (validIds.includes(brancheId)) {
        console.log(`🤖 AI determined branche ${brancheId} for "${companyName}"`);
        return brancheId;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ AI branche detection failed for "${companyName}":`, error);
      return null;
    }
  }

  /**
   * Update organization with enrichment data (website, address, phone, kvk, size, branche)
   */
  private async updateOrganizationEnrichment(
    orgId: number,
    lead: SyncLeadData
  ): Promise<void> {
    try {
      const updates: any = {};
      const customFields: any = {};

      // Add website if available (custom field)
      if (lead.website) {
        customFields[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_WEBSITE] = lead.website;
      }

      // Add address if available (standard field - must be object with value property)
      if (lead.streetAddress || lead.city || lead.postalCode) {
        const addressValue = [lead.streetAddress, lead.postalCode, lead.city]
          .filter(Boolean)
          .join(', ');
        updates.address = { value: addressValue };
      }

      // Add phone if available (custom field)
      if (lead.phone) {
        customFields[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_PHONE] = lead.phone;
      }

      // Add KvK number if available (custom field - must be a number)
      if (lead.kvkNumber) {
        const kvkNumber = typeof lead.kvkNumber === 'string'
          ? parseInt(lead.kvkNumber, 10)
          : lead.kvkNumber;
        if (!isNaN(kvkNumber)) {
          customFields[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_KVK] = kvkNumber;
        }
      }

      // Add company size if available (custom field)
      if (lead.employeeCount) {
        const sizeEnum = InstantlyPipedriveSyncService.mapEmployeeCountToSize(lead.employeeCount);
        if (sizeEnum) {
          customFields[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_SIZE] = sizeEnum;
        }
      }

      // Add branche using 3-tier fallback: Apollo industries → Job categories → AI
      let brancheEnum: number | null = null;
      let brancheSource = '';

      // Tier 1: Try Apollo industries first
      if (lead.industries && lead.industries.length > 0) {
        brancheEnum = InstantlyPipedriveSyncService.mapIndustriesToBranche(lead.industries);
        if (brancheEnum) brancheSource = 'apollo';
      }

      // Tier 2: Fallback to job categories
      if (!brancheEnum && lead.jobCategories && lead.jobCategories.length > 0) {
        brancheEnum = InstantlyPipedriveSyncService.mapJobCategoriesToBranche(lead.jobCategories);
        if (brancheEnum) brancheSource = 'job_categories';
      }

      // Tier 3: Fallback to AI
      if (!brancheEnum && lead.companyName) {
        brancheEnum = await this.determineBrancheWithAI(lead.companyName);
        if (brancheEnum) brancheSource = 'ai';
      }

      // Set branche if found
      if (brancheEnum) {
        customFields[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_BRANCHE] = brancheEnum;
        console.log(`🏭 Set branche ${brancheEnum} via ${brancheSource} for "${lead.companyName}"`);
      }

      // Add custom fields to updates if any
      if (Object.keys(customFields).length > 0) {
        updates.custom_fields = customFields;
      }

      if (Object.keys(updates).length > 0) {
        await this.pipedriveClient.updateOrganization(orgId, updates);
        console.log(`📍 Updated organization ${orgId} with enrichment data (website: ${!!lead.website}, address: ${!!updates.address}, phone: ${!!lead.phone}, kvk: ${!!lead.kvkNumber}, size: ${!!lead.employeeCount}, branche: ${!!lead.industries})`);
      }
    } catch (error) {
      console.warn(`Could not update organization enrichment for ${orgId}:`, error);
    }
  }

  /**
   * Update person with enrichment data (job title/functie, LinkedIn URL)
   */
  private async updatePersonEnrichment(
    personId: number,
    lead: SyncLeadData
  ): Promise<void> {
    try {
      // Only update if we have data to update
      if (!lead.title && !lead.linkedinUrl) return;

      const updates: any = {};

      // Add Functie if available
      if (lead.title) {
        updates[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.PERSON_FUNCTIE] = lead.title;
      }

      // Add LinkedIn URL if available
      if (lead.linkedinUrl) {
        updates[InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.PERSON_LINKEDIN] = lead.linkedinUrl;
      }

      await this.pipedriveClient.updatePerson(personId, updates);
      console.log(`👔 Updated person ${personId} with enrichment (functie: ${lead.title || 'n/a'}, linkedin: ${lead.linkedinUrl ? 'yes' : 'no'})`);
    } catch (error) {
      console.warn(`Could not update person enrichment for ${personId}:`, error);
    }
  }

  /**
   * Set the "Einde Instantly campg. Start Pipedrive" date on an organization
   * This is only called when we CREATE a new organization (not on updates)
   * The date marks when the lead left the Instantly campaign (not today's date)
   *
   * @param orgId - Pipedrive organization ID
   * @param campaignCompletedAt - ISO date string from Instantly's timestamp_updated (when lead left campaign)
   */
  private async setOrganizationStartPipedriveDate(orgId: number, campaignCompletedAt?: string): Promise<void> {
    try {
      // Use the campaign completion date from Instantly, or fallback to today
      // The campaignCompletedAt is when the lead finished/left the Instantly campaign
      let dateToSet: string;

      if (campaignCompletedAt) {
        // Parse the ISO string and format as YYYY-MM-DD
        dateToSet = new Date(campaignCompletedAt).toISOString().split('T')[0];
      } else {
        // Fallback to today if no campaign completion date available
        dateToSet = new Date().toISOString().split('T')[0];
        console.log(`⚠️ No campaignCompletedAt provided, using today's date as fallback`);
      }

      await this.pipedriveClient.updateOrganization(orgId, {
        custom_fields: {
          [InstantlyPipedriveSyncService.PIPEDRIVE_FIELDS.ORGANIZATION_START_PIPEDRIVE_DATE]: dateToSet
        }
      });

      console.log(`📅 Set "Einde Instantly / Start Pipedrive" date to ${dateToSet} for organization ${orgId}`);
    } catch (error) {
      console.warn(`Could not set Start Pipedrive date for organization ${orgId}:`, error);
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
        // Engagement events
        email_sent: 'Email verzonden',
        email_opened: 'Email geopend',
        email_link_clicked: 'Link geklikt',
        // Critical events
        email_bounced: 'Email gebounced',
        lead_unsubscribed: 'Uitgeschreven',
        // Reply events
        reply_received: 'Reply ontvangen',
        auto_reply_received: 'Auto-reply ontvangen',
        // Interest events
        lead_interested: 'Geinteresseerd',
        lead_not_interested: 'Niet geinteresseerd',
        lead_neutral: 'Neutraal - review nodig',
        // Campaign events
        campaign_completed: 'Campagne doorlopen',
        // Meeting events
        lead_meeting_booked: 'Meeting gepland',
        lead_meeting_completed: 'Meeting afgerond',
        lead_closed: 'Deal gewonnen',
        // Special events
        lead_out_of_office: 'Out of office',
        lead_wrong_person: 'Verkeerd persoon',
        account_error: 'Account error',
        // Custom label events
        custom_label_any_positive: 'Positief label',
        custom_label_any_negative: 'Negatief label',
        // Internal
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

  /**
   * Set campaign_completed_at timestamp for delayed removal from Instantly
   * After 10 days, a cron job will remove leads that haven't replied
   *
   * Note: instantly_status is already set by updateOtisContact() earlier in the flow,
   * so we only set the timestamp here to avoid redundant updates.
   */
  private async setCampaignCompletedAt(
    email: string,
    contactId: string | undefined
  ): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();
      const now = new Date().toISOString();

      if (contactId) {
        const { error } = await this.supabase
          .from('contacts')
          .update({
            instantly_campaign_completed_at: now
          })
          .eq('id', contactId);

        if (error) {
          console.warn(`Could not set campaign_completed_at for contact ${contactId}:`, error.message);
        }
      } else {
        // Try to find and update by email
        const { error } = await this.supabase
          .from('contacts')
          .update({
            instantly_campaign_completed_at: now
          })
          .eq('email', cleanEmail);

        if (error) {
          console.warn(`Could not set campaign_completed_at by email ${cleanEmail}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Failed to set campaign_completed_at for ${email}:`, error);
    }
  }

  // ============================================================================
  // BLOCKLIST MANAGEMENT
  // ============================================================================

  /**
   * Create a blocklist entry for any reason (bounce, unsubscribe, not interested, etc.)
   * Syncs to both our database and Instantly blocklist
   */
  private async createBlocklistEntry(
    email: string,
    reason: string,
    contactId?: string,
    companyId?: string
  ): Promise<{ success: boolean; error?: string }> {
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
        return { success: true };
      }

      // Add to Instantly blocklist via API
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
      }

      // Create blocklist entry in our database
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
        return { success: false, error: blocklistError.message };
      }

      // Mark the contact as blocked if we have a contact ID
      if (contactId) {
        await this.supabase
          .from('contacts')
          .update({ is_blocked: true })
          .eq('id', contactId);
      } else {
        // Try to find and mark by email
        await this.supabase
          .from('contacts')
          .update({ is_blocked: true })
          .eq('email', cleanEmail);
      }

      console.log(`🚫 Created blocklist entry for ${cleanEmail} (reason: ${reason})`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Could not create blocklist entry for ${email}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check if an email is blocklisted in our database or Instantly
   * Returns the blocklist entry if found, null otherwise
   */
  private async isEmailBlocklisted(email: string): Promise<{
    isBlocked: boolean;
    source: 'database' | 'instantly' | null;
    reason?: string;
  }> {
    const cleanEmail = email.toLowerCase().trim();

    try {
      // 1. Check our database first (faster)
      const { data: dbEntry } = await this.supabase
        .from('blocklist_entries')
        .select('id, reason, value')
        .eq('value', cleanEmail)
        .eq('type', 'email')
        .eq('is_active', true)
        .single();

      if (dbEntry) {
        console.log(`🚫 Email ${cleanEmail} found in database blocklist (reason: ${dbEntry.reason})`);
        return { isBlocked: true, source: 'database', reason: dbEntry.reason || undefined };
      }

      // 2. Also check the domain in our blocklist
      const domain = cleanEmail.split('@')[1];
      if (domain) {
        const { data: domainEntry } = await this.supabase
          .from('blocklist_entries')
          .select('id, reason, value')
          .eq('value', domain)
          .eq('type', 'domain')
          .eq('is_active', true)
          .single();

        if (domainEntry) {
          console.log(`🚫 Domain ${domain} found in database blocklist (reason: ${domainEntry.reason})`);
          return { isBlocked: true, source: 'database', reason: domainEntry.reason || undefined };
        }
      }

      // 3. Check Instantly blocklist
      const isBlockedInInstantly = await this.instantlyClient.isBlocked(cleanEmail);
      if (isBlockedInInstantly) {
        console.log(`🚫 Email ${cleanEmail} found in Instantly blocklist`);
        return { isBlocked: true, source: 'instantly', reason: 'Found in Instantly blocklist' };
      }

      return { isBlocked: false, source: null };
    } catch (error) {
      console.warn(`⚠️ Error checking blocklist for ${cleanEmail}:`, error);
      // In case of error, don't block the sync but log it
      return { isBlocked: false, source: null };
    }
  }

  // ============================================================================
  // EVENT LOGGING & ENGAGEMENT TRACKING
  // ============================================================================

  /**
   * Log an Instantly event to the instantly_email_events table for analytics
   */
  private async logInstantlyEvent(
    email: string,
    campaignId: string,
    campaignName: string,
    eventType: SyncEventType,
    payload?: any
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Get contact and company IDs if available
      const { data: contactData } = await this.supabase
        .from('contacts')
        .select('id, company_id')
        .eq('email', cleanEmail)
        .single();

      // Insert event record
      const { data: eventRecord, error } = await this.supabase
        .from('instantly_email_events')
        .insert({
          contact_id: contactData?.id || null,
          company_id: contactData?.company_id || null,
          campaign_id: campaignId,
          campaign_name: campaignName,
          event_type: eventType,
          event_timestamp: new Date().toISOString(),
          lead_email: cleanEmail,
          metadata: payload || {},
          processed: false
        })
        .select('id')
        .single();

      if (error) {
        console.warn(`⚠️ Could not log event ${eventType} for ${cleanEmail}:`, error.message);
        return { success: false, error: error.message };
      }

      return { success: true, eventId: eventRecord?.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Could not log event for ${email}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update contact engagement metrics based on event type
   */
  private async updateContactEngagement(
    email: string,
    eventType: SyncEventType
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Build the update object based on event type
      const updateData: Record<string, any> = {};

      switch (eventType) {
        case 'email_opened':
          updateData.instantly_last_open_at = new Date().toISOString();
          // Increment opens count with raw SQL
          break;
        case 'email_link_clicked':
          updateData.instantly_last_click_at = new Date().toISOString();
          break;
        case 'email_bounced':
          updateData.instantly_bounced = true;
          updateData.instantly_bounced_at = new Date().toISOString();
          updateData.qualification_status = 'bounced';
          break;
        case 'lead_unsubscribed':
          updateData.instantly_unsubscribed = true;
          updateData.instantly_unsubscribed_at = new Date().toISOString();
          updateData.qualification_status = 'unsubscribed';
          break;
        case 'lead_meeting_booked':
          updateData.instantly_meeting_booked = true;
          updateData.instantly_meeting_booked_at = new Date().toISOString();
          updateData.qualification_status = 'meeting_booked';
          break;
        case 'lead_meeting_completed':
          updateData.instantly_meeting_completed = true;
          updateData.instantly_meeting_completed_at = new Date().toISOString();
          updateData.qualification_status = 'meeting_completed';
          break;
        case 'lead_closed':
          updateData.instantly_closed_won = true;
          updateData.instantly_closed_won_at = new Date().toISOString();
          updateData.qualification_status = 'closed_won';
          break;
        case 'lead_out_of_office':
          updateData.instantly_out_of_office = true;
          break;
        case 'lead_wrong_person':
          updateData.instantly_wrong_person = true;
          updateData.qualification_status = 'wrong_person';
          break;
        default:
          // No specific engagement update for this event
          return { success: true };
      }

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      // Update the contact
      const { error } = await this.supabase
        .from('contacts')
        .update(updateData)
        .eq('email', cleanEmail);

      if (error) {
        console.warn(`⚠️ Could not update engagement for ${cleanEmail}:`, error.message);
        return { success: false, error: error.message };
      }

      // For opens/clicks, increment counters
      if (eventType === 'email_opened') {
        await this.incrementContactField(cleanEmail, 'instantly_opens_count');
      } else if (eventType === 'email_link_clicked') {
        await this.incrementContactField(cleanEmail, 'instantly_clicks_count');
      }

      // Recalculate engagement score
      await this.recalculateEngagementScore(cleanEmail);

      console.log(`📊 Updated engagement for ${cleanEmail} (event: ${eventType})`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Could not update engagement for ${email}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Increment a numeric field on a contact
   */
  private async incrementContactField(
    email: string,
    field: string
  ): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();

    // Get current value
    const { data } = await this.supabase
      .from('contacts')
      .select(field)
      .eq('email', cleanEmail)
      .single();

    const currentValue = (data as any)?.[field] || 0;

    // Update with incremented value
    await this.supabase
      .from('contacts')
      .update({ [field]: currentValue + 1 })
      .eq('email', cleanEmail);
  }

  /**
   * Recalculate engagement score for a contact
   * Score formula:
   * - Opens: 5 points each (max 25)
   * - Clicks: 15 points each (max 45)
   * - Replies: 20 points each (max 40)
   * - Meeting booked: 50 points
   * Max score: 160, normalized to 100
   */
  private async recalculateEngagementScore(email: string): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      const { data: contact } = await this.supabase
        .from('contacts')
        .select('instantly_opens_count, instantly_clicks_count, reply_count, instantly_meeting_booked')
        .eq('email', cleanEmail)
        .single();

      if (!contact) return;

      const openScore = Math.min((contact.instantly_opens_count || 0) * 5, 25);
      const clickScore = Math.min((contact.instantly_clicks_count || 0) * 15, 45);
      const replyScore = Math.min((contact.reply_count || 0) * 20, 40);
      const meetingScore = contact.instantly_meeting_booked ? 50 : 0;

      const rawScore = openScore + clickScore + replyScore + meetingScore;
      const normalizedScore = Math.min(Math.round((rawScore / 160) * 100), 100);

      await this.supabase
        .from('contacts')
        .update({ instantly_engagement_score: normalizedScore })
        .eq('email', cleanEmail);

      // Also update company aggregate if we have company linkage
      await this.updateCompanyEngagementAggregate(cleanEmail);
    } catch (error) {
      console.warn(`Could not recalculate engagement score for ${email}:`, error);
    }
  }

  /**
   * Store engagement metrics from backfill data
   */
  private async storeBackfillEngagementMetrics(
    email: string,
    engagementData: EngagementData
  ): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      const updateData: Record<string, any> = {};

      if (engagementData.opensCount > 0) {
        updateData.instantly_opens_count = engagementData.opensCount;
      }
      if (engagementData.clicksCount > 0) {
        updateData.instantly_clicks_count = engagementData.clicksCount;
      }
      if (engagementData.lastOpenAt) {
        updateData.instantly_last_open_at = engagementData.lastOpenAt;
      }
      if (engagementData.lastClickAt) {
        updateData.instantly_last_click_at = engagementData.lastClickAt;
      }
      if (engagementData.lastReplyAt) {
        updateData.last_reply_at = engagementData.lastReplyAt;
      }
      if (engagementData.currentStep) {
        updateData.instantly_current_step = engagementData.currentStep;
      }

      if (Object.keys(updateData).length > 0) {
        await this.supabase
          .from('contacts')
          .update(updateData)
          .eq('email', cleanEmail);

        // Recalculate engagement score after storing metrics
        await this.recalculateEngagementScore(cleanEmail);
      }
    } catch (error) {
      console.warn(`Could not store backfill engagement metrics for ${email}:`, error);
    }
  }

  /**
   * Update company aggregate engagement metrics
   */
  private async updateCompanyEngagementAggregate(email: string): Promise<void> {
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Get contact's company
      const { data: contact } = await this.supabase
        .from('contacts')
        .select('company_id')
        .eq('email', cleanEmail)
        .single();

      if (!contact?.company_id) return;

      // Calculate aggregates from all contacts at this company
      const { data: companyContacts } = await this.supabase
        .from('contacts')
        .select(`
          instantly_opens_count,
          instantly_clicks_count,
          reply_count,
          instantly_bounced,
          instantly_meeting_booked,
          instantly_engagement_score
        `)
        .eq('company_id', contact.company_id)
        .not('instantly_synced', 'is', null);

      if (!companyContacts || companyContacts.length === 0) return;

      const totals = companyContacts.reduce(
        (acc, c) => ({
          leads: acc.leads + 1,
          opens: acc.opens + (c.instantly_opens_count || 0),
          clicks: acc.clicks + (c.instantly_clicks_count || 0),
          replies: acc.replies + (c.reply_count || 0),
          bounces: acc.bounces + (c.instantly_bounced ? 1 : 0),
          meetings: acc.meetings + (c.instantly_meeting_booked ? 1 : 0),
          totalScore: acc.totalScore + (c.instantly_engagement_score || 0)
        }),
        { leads: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, meetings: 0, totalScore: 0 }
      );

      const avgScore = totals.leads > 0 ? totals.totalScore / totals.leads : 0;

      await this.supabase
        .from('companies')
        .update({
          instantly_total_leads: totals.leads,
          instantly_total_opens: totals.opens,
          instantly_total_clicks: totals.clicks,
          instantly_total_replies: totals.replies,
          instantly_total_bounces: totals.bounces,
          instantly_meetings_booked: totals.meetings,
          instantly_avg_engagement_score: Math.round(avgScore * 100) / 100,
          instantly_last_activity_at: new Date().toISOString()
        })
        .eq('id', contact.company_id);
    } catch (error) {
      console.warn(`Could not update company engagement aggregate:`, error);
    }
  }

  // ============================================================================
  // HOOFDDOMEIN / SUBDOMEIN HELPERS
  // ============================================================================

  /**
   * @deprecated Use companyEnrichmentService.getHoofddomeinByPostalCode() instead.
   * This method is kept for backwards compatibility but all new code should use
   * CompanyEnrichmentService (single source of truth for hoofddomein).
   *
   * Look up the regio_platform (Hoofddomein) based on company's postal code.
   * Uses the cities table to map postal codes to platforms.
   */
  async getRegioPlatformByPostalCode(postalCode: string): Promise<string | null> {
    if (!postalCode) return null;

    try {
      // Extract first 4 digits from postal code (handles "2991 XT" → "2991")
      const postcodePrefix = postalCode.replace(/\s+/g, '').substring(0, 4);

      if (!/^\d{4}$/.test(postcodePrefix)) {
        console.warn(`⚠️ Invalid postal code format: ${postalCode}`);
        return null;
      }

      // First try: exact match
      const { data, error } = await this.supabase
        .from('cities')
        .select('regio_platform')
        .eq('postcode', postcodePrefix)
        .limit(1)
        .single();

      if (data?.regio_platform) {
        console.log(`📍 Mapped postal code ${postcodePrefix} → ${data.regio_platform}`);
        return data.regio_platform;
      }

      // Second try: find nearest postcode in the same range
      // The cities table doesn't have every postcode, just representative ones per city
      // So we look for the closest postcode that IS in the table
      const postcodeNum = parseInt(postcodePrefix, 10);

      // Search within ±50 range for nearest match
      const { data: nearbyData } = await this.supabase
        .from('cities')
        .select('postcode, regio_platform')
        .gte('postcode', String(postcodeNum - 50).padStart(4, '0'))
        .lte('postcode', String(postcodeNum + 50).padStart(4, '0'))
        .not('postcode', 'like', '%XX%') // Exclude non-numeric postcodes
        .order('postcode');

      if (nearbyData && nearbyData.length > 0) {
        // Find the closest postcode
        let closest = nearbyData[0];
        let minDistance = Math.abs(parseInt(closest.postcode, 10) - postcodeNum);

        for (const city of nearbyData) {
          const distance = Math.abs(parseInt(city.postcode, 10) - postcodeNum);
          if (distance < minDistance) {
            minDistance = distance;
            closest = city;
          }
        }

        // Safety check: Only use nearby match if it's within 20 postcode units
        // Dutch postcodes are geographically ordered, but a difference of >20
        // likely means we're in a different region entirely
        const MAX_POSTCODE_DISTANCE = 20;
        if (minDistance > MAX_POSTCODE_DISTANCE) {
          console.log(`📍 No platform found for postal code ${postcodePrefix} - nearest ${closest.postcode} is too far (distance: ${minDistance})`);
          return null;
        }

        console.log(`📍 Mapped postal code ${postcodePrefix} → ${closest.regio_platform} (via nearby ${closest.postcode}, distance: ${minDistance})`);
        return closest.regio_platform;
      }

      console.log(`📍 No platform found for postal code ${postcodePrefix} (even with nearby search)`);
      return null;
    } catch (error) {
      console.error(`Error looking up platform for postal code ${postalCode}:`, error);
      return null;
    }
  }

  /**
   * @deprecated Use companyEnrichmentService.getSubdomeinen() instead.
   * This method is kept for backwards compatibility but all new code should use
   * CompanyEnrichmentService (single source of truth for subdomeinen).
   *
   * Get all unique regio_platforms where a company has job postings.
   */
  async getAllCompanyPlatforms(companyId: string): Promise<string[]> {
    if (!companyId) return [];

    try {
      const { data, error } = await this.supabase
        .from('job_postings')
        .select(`
          platform_id,
          platforms (
            regio_platform
          )
        `)
        .eq('company_id', companyId)
        .not('platform_id', 'is', null);

      if (error || !data || data.length === 0) {
        console.log(`📍 No job postings found for company ${companyId}`);
        return [];
      }

      // Extract unique platform names
      const platforms = data
        .map(jp => (jp.platforms as any)?.regio_platform)
        .filter((p): p is string => !!p);

      const uniquePlatforms = [...new Set(platforms)];
      console.log(`📍 Found ${uniquePlatforms.length} unique platforms for company: ${uniquePlatforms.join(', ')}`);

      return uniquePlatforms;
    } catch (error) {
      console.error(`Error getting platforms for company ${companyId}:`, error);
      return [];
    }
  }

  /**
   * @deprecated Use companyEnrichmentService.getCompanyPlatforms() instead.
   * This method is kept for backwards compatibility but all new code should use
   * CompanyEnrichmentService (single source of truth for hoofddomein + subdomeinen).
   *
   * Determine Hoofddomein and Subdomeinen for a company.
   */
  async determineCompanyDomeinen(
    companyId: string | undefined,
    postalCode: string | undefined
  ): Promise<{ hoofddomein: string | null; subdomeinen: string[] }> {
    // Get hoofddomein from postal code
    const hoofddomein = postalCode ? await this.getRegioPlatformByPostalCode(postalCode) : null;

    // Get all platforms from job postings
    const allPlatforms = companyId ? await this.getAllCompanyPlatforms(companyId) : [];

    // Subdomeinen = all platforms except hoofddomein
    const subdomeinen = allPlatforms.filter(p => p !== hoofddomein);

    console.log(`📍 Company domeinen: hoofddomein=${hoofddomein || 'unknown'}, subdomeinen=[${subdomeinen.join(', ')}]`);

    return { hoofddomein, subdomeinen };
  }
}

// Export singleton instance
export const instantlyPipedriveSyncService = new InstantlyPipedriveSyncService();
