/**
 * Types for Baanindebuurt.nl scraper
 */

export interface VacatureData {
  title: string;
  company_name: string;
  location: string | null;
  city: string | null;
  salary: string | null;
  description: string;
  requirements: string[] | null;
  working_hours: string | null;
}

export interface ScrapedPdf {
  pdfId: string;
  pdfUrl: string;
  rawText: string;
  parsedData: VacatureData | null;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  totalFound: number;
  processed: number;
  inserted: number;
  skipped: number;
  errors: number;
  details: ScrapedPdf[];
}

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  pdfUrls: string[];
}
