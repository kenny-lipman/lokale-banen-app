/**
 * Types for Nationale Vacaturebank API scraper
 */

/** NVB API response wrapper */
export interface NvbApiResponse {
  _embedded: {
    jobs: NvbJob[];
  };
  _links?: {
    self?: { href: string };
    next?: { href: string };
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

/** Single job from NVB API */
export interface NvbJob {
  id: string;
  title: string;
  functionTitle?: string;
  description?: string;
  company?: {
    name: string;
    website?: string;
  };
  workLocation?: {
    displayName?: string;
    city?: string;
    province?: string;
    zipCode?: string;
    street?: string;
    geolocation?: {
      latitude: string | number;
      longitude: string | number;
    };
  };
  salary?: {
    min?: number;
    max?: number;
  };
  workingHours?: {
    min?: number;
    max?: number;
  };
  contractTypes?: string[];
  contractType?: string;
  educationLevel?: string;
  careerLevel?: string;
  categories?: string[];
  industries?: string[];
  contact?: {
    emailAddress?: string;
    phoneNumber?: string;
    website?: string;
  };
  startDate?: string;
  endDate?: string;
  _links?: {
    detail?: { href: string };
  };
}

/** Scraper configuration */
export interface ScraperConfig {
  maxPagesPerRun: number;
  startPage: number;
  mode: "full" | "incremental";
  delayBetweenPages: number;
  consecutiveSkipLimit: number;
  timeoutMs: number;
}

/** Scraper result */
export interface ScrapeResult {
  success: boolean;
  pagesProcessed: number;
  totalFound: number;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  companiesCreated: number;
  companiesUpdated: number;
  contactsCreated: number;
  contactsUpdated: number;
  resumeFromPage: number | null;
  earlyExitReason: string | null;
  errorDetails: string[];
}
