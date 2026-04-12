/**
 * Shared types for all scrapers
 */

/**
 * Company data for creation/update
 */
export interface CompanyData {
  name: string;
  normalized_name?: string;
  city?: string | null;
  location?: string | null;
  street_address?: string | null;
  postal_code?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
}

/**
 * Contact data for creation/update
 */
export interface ContactData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
}

/**
 * Result of company find/create operation
 */
export interface CompanyResult {
  id: string;
  created: boolean;
  updated: boolean;
}

/**
 * Result of contact find/create operation
 */
export interface ContactResult {
  id: string;
  created: boolean;
  updated: boolean;
}

/**
 * Base scrape statistics
 */
export interface BaseScrapeStats {
  success: boolean;
  totalFound: number;
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
  companiesCreated: number;
  companiesUpdated: number;
  contactsCreated: number;
  contactsUpdated: number;
}

/**
 * Logger interface for structured logging
 */
export interface ScraperLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
