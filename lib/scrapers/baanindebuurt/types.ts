/**
 * Types for Baanindebuurt.nl scraper
 */

export interface VacatureData {
  // Vacancy fields
  title: string;
  company_name: string;
  location: string | null;
  city: string | null;
  salary: string | null;
  description: string;
  requirements: string[] | null;
  working_hours: string | null;

  // Company fields (extracted from PDF)
  company_website: string | null;
  company_phone: string | null;
  company_email: string | null;

  // Contact person fields (if mentioned in PDF)
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_title: string | null; // e.g. "HR Manager", "Recruiter"
}

export interface ScrapedPdf {
  pdfId: string;
  pdfUrl: string;
  rawText: string;
  parsedData: VacatureData | null;
  error?: string;
  // Tracking info
  companyCreated?: boolean;
  companyUpdated?: boolean;
  contactCreated?: boolean;
  contactUpdated?: boolean;
}

export interface ScrapeResult {
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
  details: ScrapedPdf[];
}

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  pdfUrls: string[];
}
