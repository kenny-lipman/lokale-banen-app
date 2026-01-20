/**
 * Types for debanensite.nl scraper
 */

/**
 * Inner source data from Elasticsearch
 */
export interface JobPostingSource {
  id?: string;
  title: string;
  description: string; // HTML content
  slug?: string;
  companyBranch?: {
    name: string;
  };
  address?: {
    city?: string;
    location?: [number, number]; // [longitude, latitude]
  };
  employmentType?: {
    name: string; // "Part-time" | "Full-time"
  };
  active?: boolean;
}

/**
 * Raw job posting data from __NEXT_DATA__ JSON (Elasticsearch format)
 */
export interface NextDataJobPosting {
  _id: string;
  _index?: string;
  _score?: number;
  _source: JobPostingSource;
  sort?: number[]; // [score, publishDate, ...]
}

/**
 * Parsed __NEXT_DATA__ structure
 */
export interface NextDataProps {
  props?: {
    pageProps?: {
      jobPostings?: NextDataJobPosting[];
      totalResults?: number;
    };
  };
}

/**
 * AI-extracted data from job description
 */
export interface AiExtractedData {
  salary: string | null;
  working_hours: string | null;
  working_hours_max: string | null;
  requirements: string[] | null;
  company_website: string | null;
  company_phone: string | null;
  company_email: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_title: string | null;
}

/**
 * Data extracted from detail page JSON-LD (Schema.org)
 */
export interface DetailPageData {
  datePosted: string | null;
  validThrough: string | null;
  province: string | null;
  workField: string | null;
  educationLevel: string | null;
  companyAddress: {
    streetAddress: string | null;
    postalCode: string | null;
    city: string | null;
  } | null;
}

/**
 * Combined vacancy data (JSON + Detail Page + AI extracted)
 */
export interface ParsedVacancy {
  // From List Page JSON
  uuid: string;
  url: string;
  title: string;
  company_name: string;
  city: string | null;
  coordinates: [number, number] | null;
  employment_type: string | null;
  description: string;
  description_plain: string;

  // From Detail Page JSON-LD
  date_posted: string | null;
  date_expires: string | null;
  province: string | null;
  work_field: string | null;
  education_level: string | null;
  company_street_address: string | null;
  company_postal_code: string | null;

  // From AI extraction
  salary: string | null;
  working_hours: string | null;
  working_hours_max: string | null;
  requirements: string[] | null;
  company_website: string | null;
  company_phone: string | null;
  company_email: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_title: string | null;

  // Computed fields
  normalized_company_name: string;
  content_hash: string;
}

/**
 * Page info from list page
 */
export interface PageInfo {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  jobPostings: NextDataJobPosting[];
}

/**
 * Scraper configuration
 */
export interface ScraperConfig {
  maxPagesPerRun: number;
  startPage: number;
  mode: "full" | "incremental";
  delayBetweenPages: number;
  delayBetweenAiCalls: number;
  fetchDetailPages: boolean;
  delayBetweenDetailFetches: number;
}

/**
 * Result of processing a single vacancy
 */
export interface ProcessedVacancy {
  uuid: string;
  title: string;
  error?: string;
  companyCreated?: boolean;
  companyUpdated?: boolean;
  contactCreated?: boolean;
  contactUpdated?: boolean;
}

/**
 * Scrape result statistics
 */
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
  errorDetails: Array<{ uuid: string; title: string; error: string }>;
  resumeFromPage?: number;
}
