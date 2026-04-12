/**
 * Parser for debanensite.nl HTML pages
 * Extracts job data from __NEXT_DATA__ JSON embedded in the page
 */

import * as cheerio from "cheerio";
import type { NextDataProps, NextDataJobPosting, PageInfo } from "./types";

const BASE_URL = "https://debanensite.nl";

/**
 * Extract __NEXT_DATA__ JSON from HTML page
 */
export function parseNextDataJson(html: string): NextDataProps | null {
  const $ = cheerio.load(html);

  // Find the __NEXT_DATA__ script tag
  const scriptTag = $("#__NEXT_DATA__");
  if (!scriptTag.length) {
    console.error("Could not find __NEXT_DATA__ script tag");
    return null;
  }

  try {
    const jsonContent = scriptTag.html();
    if (!jsonContent) {
      console.error("__NEXT_DATA__ script tag is empty");
      return null;
    }
    return JSON.parse(jsonContent) as NextDataProps;
  } catch (error) {
    console.error("Failed to parse __NEXT_DATA__ JSON:", error);
    return null;
  }
}

/**
 * Extract job postings from parsed __NEXT_DATA__
 */
export function extractJobPostings(nextData: NextDataProps): NextDataJobPosting[] {
  const jobPostings = nextData?.props?.pageProps?.jobPostings;
  if (!jobPostings || !Array.isArray(jobPostings)) {
    return [];
  }
  return jobPostings;
}

/**
 * Get total results count from __NEXT_DATA__
 */
export function getTotalResults(nextData: NextDataProps): number {
  return nextData?.props?.pageProps?.totalResults || 0;
}

/**
 * Extract pagination info from HTML
 * Looks for text like "Pagina 1 van 670"
 */
export function getPaginationInfo(html: string): { currentPage: number; totalPages: number } {
  const match = html.match(/Pagina\s+(\d+)\s+van\s+(\d+)/i);
  if (match) {
    return {
      currentPage: parseInt(match[1], 10),
      totalPages: parseInt(match[2], 10),
    };
  }
  return { currentPage: 1, totalPages: 1 };
}

/**
 * Parse a list page and return all relevant info
 */
export function parseListPage(html: string, pageNum: number): PageInfo {
  const nextData = parseNextDataJson(html);
  const pagination = getPaginationInfo(html);

  if (!nextData) {
    return {
      currentPage: pageNum,
      totalPages: pagination.totalPages,
      totalResults: 0,
      jobPostings: [],
    };
  }

  return {
    currentPage: pageNum,
    totalPages: pagination.totalPages,
    totalResults: getTotalResults(nextData),
    jobPostings: extractJobPostings(nextData),
  };
}

/**
 * Strip HTML tags from string and clean up whitespace
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

  // Load with cheerio to properly handle HTML entities
  const $ = cheerio.load(html);

  // Get text content
  let text = $.root().text();

  // Clean up whitespace
  text = text
    .replace(/\s+/g, " ") // Multiple whitespace to single space
    .replace(/\n\s*\n/g, "\n") // Multiple newlines to single
    .trim();

  return text;
}

/**
 * Generate vacancy URL from slug and UUID
 */
export function generateVacancyUrl(slug: string | undefined, uuid: string): string {
  if (slug) {
    return `${BASE_URL}/vacature/${slug}/${uuid}`;
  }
  return `${BASE_URL}/vacature/${uuid}`;
}

/**
 * Generate slug from title and company if not available
 */
export function generateSlug(title: string, company: string, city: string | null): string {
  const parts = [title, company, city].filter(Boolean);
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}
