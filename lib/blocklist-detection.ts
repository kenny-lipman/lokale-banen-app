/**
 * Smart Detection Service for Blocklist
 * Automatically detects the type of block from user input
 */

export enum BlockType {
  EMAIL = 'email',      // Specific email address
  COMPANY = 'company',  // Entire company
  DOMAIN = 'domain',    // Entire domain
  CONTACT = 'contact'   // Contact at company (handled via UI, not detection)
}

export interface DetectionResult {
  type: BlockType;
  normalized_value: string;
  confidence: 'high' | 'medium' | 'low';
  original_value: string;
}

/**
 * Detect the block type from a given value
 */
export function detectBlockType(value: string): DetectionResult {
  if (!value || typeof value !== 'string') {
    throw new Error('Invalid input value');
  }

  const trimmedValue = value.trim();

  // Email detection: contains @ with valid email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(trimmedValue)) {
    return {
      type: BlockType.EMAIL,
      normalized_value: trimmedValue.toLowerCase(),
      confidence: 'high',
      original_value: value
    };
  }

  // Domain detection: starts with @ or looks like a domain
  if (trimmedValue.startsWith('@')) {
    const domain = trimmedValue.substring(1).toLowerCase();
    // Validate it's a proper domain after removing @
    if (isValidDomain(domain)) {
      return {
        type: BlockType.DOMAIN,
        normalized_value: domain,
        confidence: 'high',
        original_value: value
      };
    }
  }

  // Check if it's a domain without @ prefix
  if (isValidDomain(trimmedValue)) {
    return {
      type: BlockType.DOMAIN,
      normalized_value: trimmedValue.toLowerCase(),
      confidence: 'medium',
      original_value: value
    };
  }

  // Default: assume it's a company name
  return {
    type: BlockType.COMPANY,
    normalized_value: trimmedValue,
    confidence: 'low',
    original_value: value
  };
}

/**
 * Validate if a string is a valid domain
 */
function isValidDomain(domain: string): boolean {
  // Basic domain validation
  // Allows subdomains, wildcards, and international domains
  const domainRegex = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  return domainRegex.test(domain);
}

/**
 * Process bulk import data with smart detection
 */
export function processBulkDetection(
  rows: Array<{ value: string; reason: string }>
): Array<DetectionResult & { reason: string }> {
  return rows.map(row => ({
    ...detectBlockType(row.value),
    reason: row.reason
  }));
}

/**
 * Convert detection result to database format
 */
export function detectionToDbFormat(detection: DetectionResult, additionalData?: {
  company_id?: string;
  contact_id?: string;
  reason: string;
}) {
  let type: 'email' | 'domain';
  let blocklist_level: 'organization' | 'contact' | 'domain';

  switch (detection.type) {
    case BlockType.EMAIL:
      type = 'email';
      blocklist_level = 'contact';
      break;
    case BlockType.DOMAIN:
      type = 'domain';
      blocklist_level = 'domain';
      break;
    case BlockType.COMPANY:
      type = 'domain';
      blocklist_level = 'organization';
      break;
    case BlockType.CONTACT:
      type = 'email';
      blocklist_level = 'contact';
      break;
    default:
      type = 'domain';
      blocklist_level = 'domain';
  }

  return {
    type,
    blocklist_level,
    value: detection.normalized_value,
    company_id: additionalData?.company_id || null,
    contact_id: additionalData?.contact_id || null,
    reason: additionalData?.reason || '',
    is_active: true
  };
}