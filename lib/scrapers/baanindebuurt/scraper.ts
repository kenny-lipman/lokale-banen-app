/**
 * Main scraper for Baanindebuurt.nl
 *
 * Flow:
 * 1. Fetch vacatures.php HTML page
 * 2. Extract all PDF URLs
 * 3. Loop through pages (pagination)
 * 4. For each PDF: download, extract text, parse with AI
 * 5. Insert into database with deduplication
 */

import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { downloadAndExtractPdf, extractPdfId } from "./pdf-parser";
import { parseVacatureWithAI } from "./ai-parser";
import type { PageInfo, ScrapeResult, ScrapedPdf } from "./types";

const BASE_URL = "https://baanindebuurt.nl";
const VACATURES_URL = `${BASE_URL}/vacatures.php`;
const JOB_SOURCE_NAME = "Baan in de Buurt";

/**
 * Create Supabase client with service role for server-side operations
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Fetch and parse a vacatures page to extract PDF URLs and pagination info
 */
async function fetchVacaturesPage(pageNum: number = 1): Promise<PageInfo> {
  const url = pageNum === 1 ? VACATURES_URL : `${VACATURES_URL}?prevnext=${pageNum}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${pageNum}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract PDF URLs
  const pdfUrls: string[] = [];
  $('a[href*="pdf/"]').each((_, element) => {
    const href = $(element).attr("href");
    if (href && href.includes(".pdf")) {
      const fullUrl = href.startsWith("http") ? href : `${BASE_URL}/${href}`;
      pdfUrls.push(fullUrl);
    }
  });

  // Extract pagination info
  // Example text: "22 vacatures gevonden. Dit is pagina 1 van 3."
  let totalPages = 1;
  const pageText = $("body").text();
  const paginationMatch = pageText.match(/pagina\s+(\d+)\s+van\s+(\d+)/i);
  if (paginationMatch) {
    totalPages = parseInt(paginationMatch[2], 10);
  }

  return {
    currentPage: pageNum,
    totalPages,
    pdfUrls,
  };
}

/**
 * Get all PDF URLs from all pages
 */
async function getAllPdfUrls(): Promise<string[]> {
  const allUrls: string[] = [];

  // Fetch first page to get pagination info
  const firstPage = await fetchVacaturesPage(1);
  allUrls.push(...firstPage.pdfUrls);

  // Fetch remaining pages
  for (let page = 2; page <= firstPage.totalPages; page++) {
    const pageInfo = await fetchVacaturesPage(page);
    allUrls.push(...pageInfo.pdfUrls);

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Remove duplicates
  return Array.from(new Set(allUrls));
}

/**
 * Get the job source ID for "Baan in de Buurt"
 */
async function getJobSourceId(supabase: SupabaseClient<any, any, any>): Promise<string> {
  const { data, error } = await supabase
    .from("job_sources")
    .select("id")
    .eq("name", JOB_SOURCE_NAME)
    .single();

  if (error || !data) {
    throw new Error(`Job source "${JOB_SOURCE_NAME}" not found`);
  }

  return data.id;
}

/**
 * Check if a vacancy already exists (deduplication)
 */
async function vacancyExists(
  supabase: SupabaseClient<any, any, any>,
  pdfId: string,
  sourceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("job_postings")
    .select("id")
    .eq("external_vacancy_id", pdfId)
    .eq("source_id", sourceId)
    .single();

  return !!data;
}

/**
 * Find or create a company by name
 */
async function findOrCreateCompany(
  supabase: SupabaseClient<any, any, any>,
  companyName: string,
  location?: string | null,
  city?: string | null
): Promise<string> {
  // Try exact match first
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .ilike("name", companyName)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new company
  const { data: newCompany, error } = await supabase
    .from("companies")
    .insert({
      name: companyName,
      location: location || null,
      city: city || null,
    })
    .select("id")
    .single();

  if (error || !newCompany) {
    throw new Error(`Failed to create company: ${error?.message || "No data returned"}`);
  }

  return newCompany.id;
}

/**
 * Insert a job posting
 */
async function insertJobPosting(
  supabase: SupabaseClient<any, any, any>,
  data: {
    title: string;
    companyId: string;
    sourceId: string;
    externalVacancyId: string;
    url: string;
    description: string;
    location?: string | null;
    city?: string | null;
    salary?: string | null;
    workingHours?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("job_postings").insert({
    title: data.title,
    company_id: data.companyId,
    source_id: data.sourceId,
    external_vacancy_id: data.externalVacancyId,
    url: data.url,
    description: data.description,
    location: data.location || null,
    city: data.city || null,
    salary: data.salary || null,
    working_hours_min: data.workingHours ? parseFloat(data.workingHours) : null,
    country: "Netherlands",
    status: "new",
    review_status: "pending",
    scraped_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to insert job posting: ${error.message}`);
  }
}

/**
 * Process a single PDF
 */
async function processPdf(
  supabase: SupabaseClient<any, any, any>,
  pdfUrl: string,
  sourceId: string
): Promise<ScrapedPdf> {
  const pdfId = extractPdfId(pdfUrl);

  const result: ScrapedPdf = {
    pdfId,
    pdfUrl,
    rawText: "",
    parsedData: null,
  };

  try {
    // Check if already exists
    if (await vacancyExists(supabase, pdfId, sourceId)) {
      result.error = "Already exists (skipped)";
      return result;
    }

    // Download and extract text
    result.rawText = await downloadAndExtractPdf(pdfUrl);

    if (!result.rawText || result.rawText.length < 50) {
      result.error = "PDF text too short or empty";
      return result;
    }

    // Parse with AI
    result.parsedData = await parseVacatureWithAI(result.rawText);

    // Find or create company
    const companyId = await findOrCreateCompany(
      supabase,
      result.parsedData.company_name,
      result.parsedData.location,
      result.parsedData.city
    );

    // Insert job posting
    await insertJobPosting(supabase, {
      title: result.parsedData.title,
      companyId,
      sourceId,
      externalVacancyId: pdfId,
      url: pdfUrl,
      description: result.parsedData.description || result.rawText.substring(0, 2000),
      location: result.parsedData.location,
      city: result.parsedData.city,
      salary: result.parsedData.salary,
      workingHours: result.parsedData.working_hours,
    });

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
    return result;
  }
}

/**
 * Main scrape function
 */
export async function scrapeBaanindebuurt(): Promise<ScrapeResult> {
  console.log("Starting Baanindebuurt scraper...");

  const result: ScrapeResult = {
    success: false,
    totalFound: 0,
    processed: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  try {
    const supabase = createSupabaseClient();
    const sourceId = await getJobSourceId(supabase);

    // Get all PDF URLs
    console.log("Fetching PDF URLs from all pages...");
    const pdfUrls = await getAllPdfUrls();
    result.totalFound = pdfUrls.length;
    console.log(`Found ${pdfUrls.length} PDFs`);

    // Process each PDF
    for (const pdfUrl of pdfUrls) {
      console.log(`Processing: ${pdfUrl}`);
      const pdfResult = await processPdf(supabase, pdfUrl, sourceId);
      result.details.push(pdfResult);
      result.processed++;

      if (pdfResult.error) {
        if (pdfResult.error.includes("Already exists")) {
          result.skipped++;
        } else {
          result.errors++;
          console.error(`Error processing ${pdfUrl}: ${pdfResult.error}`);
        }
      } else {
        result.inserted++;
        console.log(`Inserted: ${pdfResult.parsedData?.title}`);
      }

      // Small delay between PDFs to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    result.success = true;
    console.log(
      `Scraping complete: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors} errors`
    );
  } catch (error) {
    console.error("Scraper failed:", error);
    result.success = false;
  }

  return result;
}
