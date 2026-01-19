/**
 * Unified Lead Status Determination Service
 *
 * Single source of truth for determining lead status based on:
 * - Webhook events from Instantly
 * - Backfill data from Instantly API
 * - Manual status changes
 *
 * This module bridges both webhook and backfill flows with consistent logic.
 */

import {
  type InstantlyEventType,
  type StatusKey,
  type QualificationStatus,
  EVENT_CONFIG,
  STATUS_CONFIG,
  getStatusForEvent,
  getQualificationForEvent,
  shouldAddToBlocklist,
  shouldLogActivity,
  shouldUpdateEngagement,
  isValidTransition,
  shouldUpgradeStatus,
  getStatusKey,
  getStatusPriorityById,
} from '../constants/status-config';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sentiment of a reply (used for status determination)
 */
export type ReplySentiment = 'positive' | 'negative' | 'neutral';

/**
 * Engagement data captured from Instantly
 */
export interface EngagementData {
  opensCount: number;
  clicksCount: number;
  lastOpenAt?: string;
  lastClickAt?: string;
  lastReplyAt?: string;
  currentStep?: number;
  verificationStatus?: number;
}

/**
 * Context for determining lead status
 * Can be populated from webhook OR backfill data
 */
export interface LeadStatusContext {
  // Source identification
  source: 'webhook' | 'backfill' | 'manual';

  // From webhook
  eventType?: InstantlyEventType;

  // From Instantly lead data (backfill or API)
  leadStatus?: number; // -1=bounced, -2=unsubscribed, -3=skipped, 0-3=active
  interestStatus?: number; // 1=interested, -1=not_interested
  ltInterestStatus?: number; // 1=interested, -1=not_interested, 2=meeting_booked, 4=won
  replyCount?: number;
  openCount?: number;
  clickCount?: number;

  // Timestamps from Instantly
  timestampLastReply?: string;
  timestampLastOpen?: string;
  timestampLastClick?: string;

  // Current state (for transition validation)
  currentPipedriveStatusId?: number | null;

  // Force flag (bypass transition rules)
  force?: boolean;
}

/**
 * Result of status determination
 */
export interface LeadStatusResult {
  // Primary determination
  syncEventType: InstantlyEventType;
  pipedriveStatus: StatusKey | null;
  qualificationStatus: QualificationStatus | null;

  // Reply information
  hasReply: boolean;
  replySentiment?: ReplySentiment;

  // Actions to take
  shouldSync: boolean;
  shouldAddToBlocklist: boolean;
  shouldLogActivity: boolean;
  shouldUpdateEngagement: boolean;

  // Transition validation
  isValidTransition: boolean;
  shouldUpgradeStatus: boolean;

  // Engagement data (if available)
  engagementData?: EngagementData;

  // Skip reason (if shouldSync is false)
  skipReason?: string;
}

// ============================================================================
// MAIN DETERMINATION FUNCTION
// ============================================================================

/**
 * Unified function to determine lead status from any source
 *
 * @param ctx - Context containing webhook event OR lead data
 * @returns Complete status determination result
 */
export function determineLeadStatus(ctx: LeadStatusContext): LeadStatusResult {
  // Route to appropriate handler based on source
  if (ctx.source === 'webhook' && ctx.eventType) {
    return determineFromWebhook(ctx);
  }

  if (ctx.source === 'backfill') {
    return determineFromBackfill(ctx);
  }

  // Manual or unknown source - return safe defaults
  return {
    syncEventType: 'backfill',
    pipedriveStatus: null,
    qualificationStatus: null,
    hasReply: false,
    shouldSync: false,
    shouldAddToBlocklist: false,
    shouldLogActivity: false,
    shouldUpdateEngagement: false,
    isValidTransition: true,
    shouldUpgradeStatus: false,
    skipReason: 'Unknown source or missing data',
  };
}

// ============================================================================
// WEBHOOK DETERMINATION
// ============================================================================

/**
 * Determine status from webhook event
 */
function determineFromWebhook(ctx: LeadStatusContext): LeadStatusResult {
  const eventType = ctx.eventType!;
  const eventConfig = EVENT_CONFIG[eventType];

  // Get target status
  const pipedriveStatus = getStatusForEvent(eventType);
  const qualificationStatus = getQualificationForEvent(eventType);

  // Determine reply sentiment based on event type
  const { hasReply, replySentiment } = determineReplySentiment(eventType);

  // Check transition validity
  const currentStatusKey = ctx.currentPipedriveStatusId
    ? getStatusKey(ctx.currentPipedriveStatusId)
    : null;

  const validTransition = pipedriveStatus
    ? isValidTransition(currentStatusKey, pipedriveStatus, ctx.force)
    : true;

  const upgradeStatus = pipedriveStatus
    ? shouldUpgradeStatus(ctx.currentPipedriveStatusId ?? null, pipedriveStatus, ctx.force)
    : false;

  // Determine if we should sync
  const shouldSync = determineShouldSync(eventType, pipedriveStatus, validTransition, upgradeStatus, ctx.force);

  return {
    syncEventType: eventType,
    pipedriveStatus,
    qualificationStatus,
    hasReply,
    replySentiment,
    shouldSync,
    shouldAddToBlocklist: shouldAddToBlocklist(eventType),
    shouldLogActivity: shouldLogActivity(eventType),
    shouldUpdateEngagement: shouldUpdateEngagement(eventType),
    isValidTransition: validTransition,
    shouldUpgradeStatus: upgradeStatus,
    skipReason: shouldSync ? undefined : determineSkipReason(eventType, validTransition, upgradeStatus),
  };
}

// ============================================================================
// BACKFILL DETERMINATION
// ============================================================================

/**
 * Determine status from backfill/API lead data
 *
 * Priority order:
 * 1. Bounce/Unsubscribe (critical - blocklist)
 * 2. Meeting booked/Won (high value)
 * 3. Interested/Not interested
 * 4. Has reply
 * 5. Campaign completed (default)
 */
function determineFromBackfill(ctx: LeadStatusContext): LeadStatusResult {
  // Build engagement data
  const engagementData: EngagementData = {
    opensCount: ctx.openCount ?? 0,
    clicksCount: ctx.clickCount ?? 0,
    lastOpenAt: ctx.timestampLastOpen,
    lastClickAt: ctx.timestampLastClick,
    lastReplyAt: ctx.timestampLastReply,
  };

  // PRIORITY 1: Check for bounce/unsubscribe (from status field)
  if (ctx.leadStatus === -1) {
    return createBackfillResult('email_bounced', false, undefined, engagementData, ctx);
  }
  if (ctx.leadStatus === -2) {
    return createBackfillResult('lead_unsubscribed', false, undefined, engagementData, ctx);
  }

  // PRIORITY 2: Check lt_interest_status for meeting/won (higher priority values)
  const ltStatus = ctx.ltInterestStatus ?? ctx.interestStatus;

  if (ltStatus === 2) {
    // Meeting booked
    return createBackfillResult('lead_meeting_booked', true, 'positive', engagementData, ctx);
  }
  if (ltStatus === 4) {
    // Won/Closed
    return createBackfillResult('lead_closed', true, 'positive', engagementData, ctx);
  }

  // PRIORITY 3: Check interest status
  if (ltStatus === 1) {
    // Interested
    return createBackfillResult('lead_interested', true, 'positive', engagementData, ctx);
  }
  if (ltStatus === -1) {
    // Not interested
    return createBackfillResult('lead_not_interested', true, 'negative', engagementData, ctx);
  }

  // PRIORITY 4: Check for replies
  const hasReply = (ctx.replyCount ?? 0) > 0;
  if (hasReply) {
    // Reply but no sentiment classification yet - mark as neutral/review
    return createBackfillResult('reply_received', true, 'neutral', engagementData, ctx);
  }

  // PRIORITY 5: Default - campaign completed without reply
  return createBackfillResult('backfill', false, undefined, engagementData, ctx);
}

/**
 * Helper to create a backfill result with proper validation
 */
function createBackfillResult(
  eventType: InstantlyEventType,
  hasReply: boolean,
  replySentiment: ReplySentiment | undefined,
  engagementData: EngagementData,
  ctx: LeadStatusContext
): LeadStatusResult {
  const pipedriveStatus = getStatusForEvent(eventType);
  const qualificationStatus = getQualificationForEvent(eventType);

  // Check transition validity
  const currentStatusKey = ctx.currentPipedriveStatusId
    ? getStatusKey(ctx.currentPipedriveStatusId)
    : null;

  const validTransition = pipedriveStatus
    ? isValidTransition(currentStatusKey, pipedriveStatus, ctx.force)
    : true;

  const upgradeStatus = pipedriveStatus
    ? shouldUpgradeStatus(ctx.currentPipedriveStatusId ?? null, pipedriveStatus, ctx.force)
    : false;

  // For backfill, we always sync to capture data, but status change depends on upgrade check
  const shouldSync = true;

  return {
    syncEventType: eventType,
    pipedriveStatus,
    qualificationStatus,
    hasReply,
    replySentiment,
    shouldSync,
    shouldAddToBlocklist: shouldAddToBlocklist(eventType),
    shouldLogActivity: shouldLogActivity(eventType),
    shouldUpdateEngagement: shouldUpdateEngagement(eventType),
    isValidTransition: validTransition,
    shouldUpgradeStatus: upgradeStatus,
    engagementData,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine reply sentiment based on event type
 */
function determineReplySentiment(eventType: InstantlyEventType): {
  hasReply: boolean;
  replySentiment?: ReplySentiment;
} {
  switch (eventType) {
    // Positive signals
    case 'lead_interested':
    case 'lead_meeting_booked':
    case 'lead_meeting_completed':
    case 'lead_closed':
      return { hasReply: true, replySentiment: 'positive' };

    // Negative signals
    case 'lead_not_interested':
    case 'email_bounced':
    case 'lead_unsubscribed':
    case 'lead_wrong_person':
      return { hasReply: false, replySentiment: 'negative' };

    // Neutral/Review signals
    case 'reply_received':
    case 'auto_reply_received':
    case 'lead_neutral':
      return { hasReply: true, replySentiment: 'neutral' };

    // No reply events
    case 'email_sent':
    case 'email_opened':
    case 'email_link_clicked':
    case 'campaign_completed':
    case 'lead_out_of_office':
    case 'account_error':
    case 'lead_added':
    case 'backfill':
    default:
      return { hasReply: false };
  }
}

/**
 * Determine if we should sync based on event and transition rules
 */
function determineShouldSync(
  eventType: InstantlyEventType,
  pipedriveStatus: StatusKey | null,
  validTransition: boolean,
  upgradeStatus: boolean,
  force?: boolean
): boolean {
  // Force always syncs
  if (force) return true;

  // Engagement-only events (no status change) - always sync for logging
  const engagementOnlyEvents: InstantlyEventType[] = [
    'email_sent',
    'email_opened',
    'email_link_clicked',
    'lead_out_of_office',
    'account_error',
  ];
  if (engagementOnlyEvents.includes(eventType)) {
    return true; // Sync for logging/tracking, but no status change
  }

  // Events that should always sync (critical)
  const criticalEvents: InstantlyEventType[] = [
    'email_bounced',
    'lead_unsubscribed',
    'lead_not_interested',
  ];
  if (criticalEvents.includes(eventType)) {
    return true; // Always sync blocklist events
  }

  // For status-changing events, check if we should upgrade
  if (pipedriveStatus) {
    return upgradeStatus || validTransition;
  }

  return true;
}

/**
 * Determine skip reason for logging
 */
function determineSkipReason(
  eventType: InstantlyEventType,
  validTransition: boolean,
  upgradeStatus: boolean
): string {
  if (!validTransition) {
    return `Invalid status transition for event ${eventType}`;
  }
  if (!upgradeStatus) {
    return `Current status has higher priority than ${eventType} would set`;
  }
  return `Skipped due to business rules for ${eventType}`;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Check if an event type triggers blocklist addition
 */
export function isBlocklistEvent(eventType: InstantlyEventType): boolean {
  return shouldAddToBlocklist(eventType);
}

/**
 * Check if an event type is engagement-only (no status change)
 */
export function isEngagementOnlyEvent(eventType: InstantlyEventType): boolean {
  return getStatusForEvent(eventType) === null;
}

/**
 * Check if an event type indicates a hot lead (meeting/interested)
 */
export function isHotLeadEvent(eventType: InstantlyEventType): boolean {
  const hotEvents: InstantlyEventType[] = [
    'lead_interested',
    'lead_meeting_booked',
    'lead_meeting_completed',
    'lead_closed',
  ];
  return hotEvents.includes(eventType);
}

/**
 * Get the effective interest status from Instantly lead data
 * Prefers lt_interest_status over interest_status
 */
export function getEffectiveInterestStatus(
  interestStatus?: number,
  ltInterestStatus?: number
): number | undefined {
  // lt_interest_status has more granular values (includes meeting_booked=2, won=4)
  return ltInterestStatus ?? interestStatus;
}
