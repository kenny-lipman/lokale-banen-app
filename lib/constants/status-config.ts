/**
 * Centralized Status Configuration for Instantly-Pipedrive Integration
 *
 * This file defines all status-related constants, transitions, and mappings
 * used throughout the sync process. Single source of truth for:
 * - Pipedrive Status Prospect values
 * - Status priorities
 * - Valid state transitions
 * - Event type to status mappings
 */

// ============================================================================
// PIPEDRIVE STATUS PROSPECT CONFIGURATION
// ============================================================================

/**
 * Pipedrive custom field IDs
 */
export const PIPEDRIVE_FIELD_IDS = {
  STATUS_PROSPECT: 'e8a27f47529d2091399f063b834339316d7d852a',
  HOOFDDOMEIN: '7180a7123d1de658e8d1d642b8496802002ddc66',
  ORGANIZATION_WEBSITE: '79f6688e77fed7099077425e7f956d52aaa9defb',
  PERSON_FUNCTIE: 'eff8a3361f8ec8bc1c3edc57b170019bdf9d99f3',
} as const;

/**
 * Status Prospect configuration with all metadata
 */
export const STATUS_CONFIG = {
  KLANT: {
    id: 303,
    key: 'KLANT',
    label: 'Klant',
    priority: 100,
    isProtected: true,
    isTerminal: true,
    description: 'Customer - highest status, protected from changes',
  },
  IN_ONDERHANDELING: {
    id: 322,
    key: 'IN_ONDERHANDELING',
    label: 'In onderhandeling',
    priority: 90,
    isProtected: true,
    isTerminal: false,
    description: 'In negotiation - protected from automatic changes',
  },
  BENADEREN: {
    id: 302,
    key: 'BENADEREN',
    label: 'Benaderen',
    priority: 80,
    isProtected: false,
    isTerminal: false,
    description: 'Should be contacted - positive response received',
  },
  IN_CAMPAGNE: {
    id: 345,
    key: 'IN_CAMPAGNE',
    label: 'In campagne Instantly',
    priority: 50,
    isProtected: false,
    isTerminal: false,
    description: 'Currently in Instantly campaign',
  },
  NIET_GEREAGEERD_INSTANTLY: {
    id: 344,
    key: 'NIET_GEREAGEERD_INSTANTLY',
    label: 'Niet gereageerd Instantly',
    priority: 40,
    isProtected: false,
    isTerminal: false,
    description: 'Campaign completed without reply',
  },
  OPNIEUW_BENADEREN: {
    id: 305,
    key: 'OPNIEUW_BENADEREN',
    label: 'Opnieuw Benaderen',
    priority: 30,
    isProtected: false,
    isTerminal: false,
    description: 'Should be contacted again',
  },
  NIET_MEER_BENADEREN: {
    id: 304,
    key: 'NIET_MEER_BENADEREN',
    label: 'Niet meer Benaderen',
    priority: 10,
    isProtected: false,
    isTerminal: true,
    description: 'Do not contact - negative response, bounce, or unsubscribe',
  },
} as const;

export type StatusKey = keyof typeof STATUS_CONFIG;
export type StatusId = (typeof STATUS_CONFIG)[StatusKey]['id'];

// ============================================================================
// VALID STATE TRANSITIONS
// ============================================================================

/**
 * Valid transitions from each status
 * Key: current status, Value: array of valid next statuses
 */
export const VALID_TRANSITIONS: Record<StatusKey, StatusKey[]> = {
  IN_CAMPAGNE: ['BENADEREN', 'NIET_GEREAGEERD_INSTANTLY', 'NIET_MEER_BENADEREN', 'KLANT'],
  NIET_GEREAGEERD_INSTANTLY: ['BENADEREN', 'NIET_MEER_BENADEREN', 'KLANT', 'IN_ONDERHANDELING'],
  BENADEREN: ['IN_ONDERHANDELING', 'NIET_MEER_BENADEREN', 'KLANT'],
  IN_ONDERHANDELING: ['KLANT', 'NIET_MEER_BENADEREN'],
  KLANT: [], // Terminal state - no transitions allowed
  OPNIEUW_BENADEREN: ['BENADEREN', 'IN_CAMPAGNE', 'NIET_MEER_BENADEREN', 'KLANT'],
  NIET_MEER_BENADEREN: ['BENADEREN', 'OPNIEUW_BENADEREN'], // Only with force=true (re-engage)
};

// ============================================================================
// INSTANTLY EVENT TYPES
// ============================================================================

/**
 * All supported Instantly webhook event types
 */
export const INSTANTLY_EVENT_TYPES = [
  // Engagement events (no status change)
  'email_sent',
  'email_opened',
  'email_link_clicked',

  // Critical events (blocklist)
  'email_bounced',
  'lead_unsubscribed',

  // Reply events
  'reply_received',
  'auto_reply_received',

  // Interest events
  'lead_interested',
  'lead_not_interested',
  'lead_neutral',

  // Campaign events
  'campaign_completed',

  // Meeting events (high value)
  'lead_meeting_booked',
  'lead_meeting_completed',
  'lead_closed',

  // Special events
  'lead_out_of_office',
  'lead_wrong_person',
  'account_error',

  // Internal
  'lead_added',
  'backfill',
] as const;

export type InstantlyEventType = (typeof INSTANTLY_EVENT_TYPES)[number];

// ============================================================================
// EVENT TO STATUS MAPPING
// ============================================================================

/**
 * Event type configuration with status mapping and behavior
 */
export const EVENT_CONFIG: Record<
  InstantlyEventType,
  {
    pipedriveStatus: StatusKey | null;
    qualificationStatus: string | null;
    addToBlocklist: boolean;
    logActivity: boolean;
    updateEngagement: boolean;
    description: string;
  }
> = {
  // Engagement events - no status change, just tracking
  email_sent: {
    pipedriveStatus: null,
    qualificationStatus: null,
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: false,
    description: 'Email was sent to lead',
  },
  email_opened: {
    pipedriveStatus: null,
    qualificationStatus: null,
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Lead opened the email',
  },
  email_link_clicked: {
    pipedriveStatus: null,
    qualificationStatus: null,
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Lead clicked a link in the email',
  },

  // Critical blocklist events
  email_bounced: {
    pipedriveStatus: 'NIET_MEER_BENADEREN',
    qualificationStatus: 'bounced',
    addToBlocklist: true,
    logActivity: false,
    updateEngagement: false,
    description: 'Email bounced - invalid address',
  },
  lead_unsubscribed: {
    pipedriveStatus: 'NIET_MEER_BENADEREN',
    qualificationStatus: 'unsubscribed',
    addToBlocklist: true,
    logActivity: false,
    updateEngagement: false,
    description: 'Lead unsubscribed - GDPR compliance',
  },

  // Reply events
  reply_received: {
    pipedriveStatus: 'BENADEREN',
    qualificationStatus: 'review',
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Lead replied to email',
  },
  auto_reply_received: {
    pipedriveStatus: 'BENADEREN',
    qualificationStatus: 'review',
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Auto-reply received from lead',
  },

  // Interest events
  lead_interested: {
    pipedriveStatus: 'BENADEREN',
    qualificationStatus: 'qualified',
    addToBlocklist: false,
    logActivity: false,
    updateEngagement: true,
    description: 'Lead marked as interested',
  },
  lead_not_interested: {
    pipedriveStatus: 'NIET_MEER_BENADEREN',
    qualificationStatus: 'disqualified',
    addToBlocklist: true,
    logActivity: false,
    updateEngagement: false,
    description: 'Lead marked as not interested',
  },
  lead_neutral: {
    pipedriveStatus: null,
    qualificationStatus: 'review',
    addToBlocklist: false,
    logActivity: false,
    updateEngagement: false,
    description: 'Lead marked as neutral - needs manual review',
  },

  // Campaign events
  campaign_completed: {
    pipedriveStatus: 'NIET_GEREAGEERD_INSTANTLY',
    qualificationStatus: 'enriched',
    addToBlocklist: false,
    logActivity: false,
    updateEngagement: false,
    description: 'Campaign completed without reply',
  },

  // Meeting events (high value)
  lead_meeting_booked: {
    pipedriveStatus: 'BENADEREN',
    qualificationStatus: 'meeting_booked',
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Meeting booked with lead - HOT LEAD',
  },
  lead_meeting_completed: {
    pipedriveStatus: 'IN_ONDERHANDELING',
    qualificationStatus: 'meeting_completed',
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Meeting completed with lead',
  },
  lead_closed: {
    pipedriveStatus: 'KLANT',
    qualificationStatus: 'closed_won',
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: true,
    description: 'Deal closed/won',
  },

  // Special events
  lead_out_of_office: {
    pipedriveStatus: null,
    qualificationStatus: null,
    addToBlocklist: false,
    logActivity: true,
    updateEngagement: false,
    description: 'Out of office reply detected',
  },
  lead_wrong_person: {
    pipedriveStatus: 'NIET_MEER_BENADEREN',
    qualificationStatus: 'wrong_person',
    addToBlocklist: false, // Don't blocklist - might want different contact at company
    logActivity: true,
    updateEngagement: false,
    description: 'Wrong person contacted',
  },
  account_error: {
    pipedriveStatus: null,
    qualificationStatus: null,
    addToBlocklist: false,
    logActivity: false,
    updateEngagement: false,
    description: 'Email account error - system event',
  },

  // Internal events
  lead_added: {
    pipedriveStatus: 'IN_CAMPAGNE',
    qualificationStatus: 'in_campaign',
    addToBlocklist: false,
    logActivity: false,
    updateEngagement: false,
    description: 'Lead added to campaign',
  },
  backfill: {
    pipedriveStatus: 'NIET_GEREAGEERD_INSTANTLY',
    qualificationStatus: 'enriched',
    addToBlocklist: false,
    logActivity: false,
    updateEngagement: false,
    description: 'Backfill sync - campaign completed without reply',
  },
};

// ============================================================================
// QUALIFICATION STATUS
// ============================================================================

/**
 * All valid qualification statuses for contacts
 */
export const QUALIFICATION_STATUSES = [
  'pending',
  'qualified',
  'review',
  'disqualified',
  'in_campaign',
  'synced_to_pipedrive',
  'meeting_booked',
  'meeting_completed',
  'closed_won',
  'bounced',
  'unsubscribed',
  'wrong_person',
  'enriched',
] as const;

export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get status config by key
 */
export function getStatusConfig(key: StatusKey) {
  return STATUS_CONFIG[key];
}

/**
 * Get status config by ID
 */
export function getStatusConfigById(id: number) {
  return Object.values(STATUS_CONFIG).find((s) => s.id === id);
}

/**
 * Get status priority by key
 */
export function getStatusPriority(key: StatusKey): number {
  return STATUS_CONFIG[key]?.priority ?? 0;
}

/**
 * Get status priority by ID
 */
export function getStatusPriorityById(id: number): number {
  return getStatusConfigById(id)?.priority ?? 0;
}

/**
 * Check if a status is protected
 */
export function isProtectedStatus(keyOrId: StatusKey | number): boolean {
  if (typeof keyOrId === 'number') {
    return getStatusConfigById(keyOrId)?.isProtected ?? false;
  }
  return STATUS_CONFIG[keyOrId]?.isProtected ?? false;
}

/**
 * Check if a status transition is valid
 * @param from Current status key
 * @param to Target status key
 * @param force Force the transition even if not normally valid
 */
export function isValidTransition(from: StatusKey | null, to: StatusKey, force: boolean = false): boolean {
  if (force) return true;
  if (!from) return true; // No current status, any transition is valid

  const validTargets = VALID_TRANSITIONS[from];
  return validTargets?.includes(to) ?? false;
}

/**
 * Check if status should be upgraded based on priority
 * @param currentStatusId Current Pipedrive status ID
 * @param newStatusKey New status key to set
 * @param force Force the change regardless of priority
 */
export function shouldUpgradeStatus(
  currentStatusId: number | null,
  newStatusKey: StatusKey,
  force: boolean = false
): boolean {
  if (force) return true;
  if (!currentStatusId) return true;

  const currentPriority = getStatusPriorityById(currentStatusId);
  const newPriority = getStatusPriority(newStatusKey);

  // Special case: NIET_MEER_BENADEREN should always be allowed (explicit rejection)
  if (newStatusKey === 'NIET_MEER_BENADEREN') return true;

  return newPriority >= currentPriority;
}

/**
 * Get the Pipedrive status for an Instantly event type
 */
export function getStatusForEvent(eventType: InstantlyEventType): StatusKey | null {
  return EVENT_CONFIG[eventType]?.pipedriveStatus ?? null;
}

/**
 * Get the qualification status for an Instantly event type
 */
export function getQualificationForEvent(eventType: InstantlyEventType): QualificationStatus | null {
  const status = EVENT_CONFIG[eventType]?.qualificationStatus;
  return status as QualificationStatus | null;
}

/**
 * Check if an event should add the lead to blocklist
 */
export function shouldAddToBlocklist(eventType: InstantlyEventType): boolean {
  return EVENT_CONFIG[eventType]?.addToBlocklist ?? false;
}

/**
 * Check if an event should log a Pipedrive activity
 */
export function shouldLogActivity(eventType: InstantlyEventType): boolean {
  return EVENT_CONFIG[eventType]?.logActivity ?? false;
}

/**
 * Check if an event should update engagement metrics
 */
export function shouldUpdateEngagement(eventType: InstantlyEventType): boolean {
  return EVENT_CONFIG[eventType]?.updateEngagement ?? false;
}

/**
 * Get status ID by key
 */
export function getStatusId(key: StatusKey): number {
  return STATUS_CONFIG[key].id;
}

/**
 * Get status key by ID
 */
export function getStatusKey(id: number): StatusKey | null {
  const config = getStatusConfigById(id);
  return config?.key as StatusKey | null;
}

/**
 * Get status label by key
 */
export function getStatusLabel(key: StatusKey): string {
  return STATUS_CONFIG[key].label;
}

// ============================================================================
// BACKWARDS COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Legacy export for backwards compatibility with pipedrive-client.ts
 */
export const STATUS_PROSPECT_OPTIONS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([key, config]) => [key, config.id])
) as Record<StatusKey, number>;

export const STATUS_PROSPECT_LABELS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([key, config]) => [key, config.label])
) as Record<StatusKey, string>;

export const PROTECTED_STATUSES = Object.values(STATUS_CONFIG)
  .filter((config) => config.isProtected)
  .map((config) => config.id);

export const STATUS_PRIORITY = Object.fromEntries(
  Object.values(STATUS_CONFIG).map((config) => [config.id, config.priority])
) as Record<number, number>;
