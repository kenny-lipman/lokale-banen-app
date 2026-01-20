/**
 * Shared scraper utilities
 *
 * This module provides common functionality used by all scrapers:
 * - Database client creation
 * - Company and contact CRUD with deduplication
 * - Utility functions (phone normalization, name parsing, etc.)
 */

// Database
export {
  createSupabaseClient,
  getOrCreateJobSource,
  vacancyExists,
  type SupabaseClient,
} from "./db-client";

// Services
export { findOrCreateCompany } from "./company-service";
export { findOrCreateContact } from "./contact-service";

// Utilities
export {
  delay,
  normalizePhone,
  parseName,
  generateNormalizedName,
  generateContentHash,
  stripHtmlTags,
} from "./utils";

// Types
export type {
  CompanyData,
  ContactData,
  CompanyResult,
  ContactResult,
  BaseScrapeStats,
  ScraperLogger,
} from "./types";
