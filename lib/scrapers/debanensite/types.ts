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
 * Combined vacancy data (JSON + AI extracted)
 */
export interface ParsedVacancy {
  // From JSON
  uuid: string;
  url: string;
  title: string;
  company_name: string;
  city: string | null;
  coordinates: [number, number] | null;
  employment_type: string | null;
  description: string;
  description_plain: string;

  // From AI
  salary: string | null;
  working_hours: string | null;
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
  errorDetails: Array<{ uuid: string; title: string; error: string }>;
  resumeFromPage?: number;
}
