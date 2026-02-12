/**
 * Main scraper for debanensite.nl
 *
 * Flow:
 * 1. Fetch list pages (/vacatures?page=X)
 * 2. Extract job data from __NEXT_DATA__ JSON
 * 3. For each job: fetch detail page + extract extra fields with Mistral AI
 * 4. Insert into database with deduplication
 */

import {
  createSupabaseClient,
  getOrCreateJobSource,
  vacancyExists,
  findOrCreateCompany,
  findOrCreateContact,
  delay,
  generateNormalizedName,
  generateContentHash,
  stripHtmlTags,
  type SupabaseClient,
} from "../shared";
import { parseListPage, generateVacancyUrl, generateSlug } from "./parser";
import { extractDataWithAI } from "./ai-parser";
import { fetchDetailPage } from "./detail-parser";
import type {
  ScraperConfig,
  ScrapeResult,
  ParsedVacancy,
  NextDataJobPosting,
  ProcessedVacancy,
  DetailPageData,
} from "./types";

const BASE_URL = "https://debanensite.nl";
const VACATURES_URL = `${BASE_URL}/vacatures`;
const JOB_SOURCE_NAME = "De Banensite";

const DEFAULT_CONFIG: ScraperConfig = {
  maxPagesPerRun: 50,
  startPage: 1,
  mode: "incremental",
  delayBetweenPages: 500,
  delayBetweenAiCalls: 100,
  fetchDetailPages: true,
  delayBetweenDetailFetches: 200,
};

/**
 * Fetch a page with retry logic
 */
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LokaleBanen/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error("Fetch failed after retries");
}

/**
 * Insert a job posting with all available data
 */
async function insertJobPosting(
  supabase: SupabaseClient,
  vacancy: ParsedVacancy,
  companyId: string,
  sourceId: string
): Promise<void> {
  // Parse working hours to number if possible
  let workingHoursMin: number | null = null;
  let workingHoursMax: number | null = null;

  if (vacancy.working_hours) {
    const hoursMatch = vacancy.working_hours.toString().match(/(\d+)/);
    if (hoursMatch) {
      workingHoursMin = parseInt(hoursMatch[1], 10);
    }
  }

  if (vacancy.working_hours_max) {
    const maxMatch = vacancy.working_hours_max.toString().match(/(\d+)/);
    if (maxMatch) {
      workingHoursMax = parseInt(maxMatch[1], 10);
    }
  }

  // Extract coordinates (format: [longitude, latitude])
  const longitude = vacancy.coordinates?.[0]?.toString() || null;
  const latitude = vacancy.coordinates?.[1]?.toString() || null;

  const { error } = await supabase.from("job_postings").insert({
    title: vacancy.title,
    company_id: companyId,
    source_id: sourceId,
    external_vacancy_id: vacancy.uuid,
    url: vacancy.url,
    description: vacancy.description,

    // Location
    city: vacancy.city,
    state: vacancy.province,
    country: "Netherlands",
    zipcode: vacancy.company_postal_code,
    street: vacancy.company_street_address,
    latitude,
    longitude,

    // Job details
    employment:
      vacancy.employment_type === "Full-time"
        ? "Fulltime"
        : vacancy.employment_type === "Part-time"
          ? "Parttime"
          : null,
    categories: vacancy.work_field,
    education_level: vacancy.education_level,
    salary: vacancy.salary,
    working_hours_min: workingHoursMin,
    working_hours_max: workingHoursMax,

    // Dates
    created_at: vacancy.date_posted || new Date().toISOString(),
    end_date: vacancy.date_expires,
    scraped_at: new Date().toISOString(),

    // Dedup & status
    content_hash: vacancy.content_hash,
    status: "new",
    review_status: "pending",
  });

  if (error) {
    throw new Error(`Failed to insert job posting: ${error.message}`);
  }
}

/**
 * Process a single vacancy
 * Flow: Check exists → Fetch detail page → AI extraction → DB inserts
 */
async function processVacancy(
  supabase: SupabaseClient,
  job: NextDataJobPosting,
  sourceId: string,
  config: ScraperConfig
): Promise<ProcessedVacancy> {
  // Extract data from _source (Elasticsearch format)
  const source = job._source;
  const title = source?.title || "Onbekende functie";

  const result: ProcessedVacancy = {
    uuid: job._id,
    title: title,
  };

  try {
    // Check if already exists
    const existing = await vacancyExists(supabase, job._id, sourceId);
    if (existing.exists && config.mode === "incremental") {
      result.error = "Already exists (skipped)";
      return result;
    }

    // Extract basic data from _source
    const companyName = source?.companyBranch?.name || "Onbekend";
    const city = source?.address?.city || null;
    const coordinates = source?.address?.location || null;
    const employmentType = source?.employmentType?.name || null;
    const descriptionHtml = source?.description || "";
    const descriptionPlain = stripHtmlTags(descriptionHtml);

    // Generate URL
    const slug = source?.slug || generateSlug(title, companyName, city);
    const url = generateVacancyUrl(slug, job._id);

    // Fetch detail page for structured JSON-LD data (only for new vacancies)
    let detailData: DetailPageData | null = null;
    if (config.fetchDetailPages) {
      await delay(config.delayBetweenDetailFetches);
      detailData = await fetchDetailPage(url);
    }

    // Extract extra data with AI
    await delay(config.delayBetweenAiCalls);
    const aiData = await extractDataWithAI(descriptionPlain);

    // Generate computed fields
    const normalizedCompanyName = generateNormalizedName(companyName);
    const contentHash = generateContentHash(title, companyName, city || "", url);

    // Build salary string: prefer structured JSON-LD data, fallback to AI extraction
    let salary = aiData.salary;
    if (detailData?.salaryMin != null) {
      const fmt = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const periodMap: Record<string, string> = { MONTH: "per maand", YEAR: "per jaar", HOUR: "per uur" };
      const period = detailData.salaryPeriod ? periodMap[detailData.salaryPeriod] || detailData.salaryPeriod.toLowerCase() : "";
      salary = detailData.salaryMax != null
        ? `${fmt(detailData.salaryMin)} - ${fmt(detailData.salaryMax)}${period ? ` ${period}` : ""}`
        : `${fmt(detailData.salaryMin)}${period ? ` ${period}` : ""}`;
    }

    // Combine all data: List JSON + Detail JSON-LD + AI extraction
    const vacancy: ParsedVacancy = {
      // From List Page JSON
      uuid: job._id,
      url,
      title: title,
      company_name: companyName,
      city,
      coordinates,
      employment_type: employmentType,
      description: descriptionHtml,
      description_plain: descriptionPlain,

      // From Detail Page JSON-LD
      date_posted: detailData?.datePosted || null,
      date_expires: detailData?.validThrough || null,
      province: detailData?.province || null,
      work_field: detailData?.workField || null,
      education_level: detailData?.educationLevel || null,
      company_street_address: detailData?.companyAddress?.streetAddress || null,
      company_postal_code: detailData?.companyAddress?.postalCode || null,
      company_logo_url: detailData?.logoUrl || null,

      // From AI extraction (salary overridden by JSON-LD above)
      ...aiData,
      salary,

      // Computed fields
      normalized_company_name: normalizedCompanyName,
      content_hash: contentHash,
    };

    // Find or create company with all available data
    const companyResult = await findOrCreateCompany(
      supabase,
      {
        name: vacancy.company_name,
        city: vacancy.city,
        street_address: vacancy.company_street_address,
        postal_code: vacancy.company_postal_code,
        website: vacancy.company_website,
        phone: vacancy.company_phone,
        email: vacancy.company_email,
        logo_url: vacancy.company_logo_url,
      },
      sourceId
    );

    result.companyCreated = companyResult.created;
    result.companyUpdated = companyResult.updated;

    // Create contact if info available
    const contactResult = await findOrCreateContact(
      supabase,
      companyResult.id,
      {
        name: vacancy.contact_name,
        email: vacancy.contact_email,
        phone: vacancy.contact_phone,
        title: vacancy.contact_title,
      },
      JOB_SOURCE_NAME
    );

    result.contactCreated = contactResult?.created || false;
    result.contactUpdated = contactResult?.updated || false;

    // Insert job posting
    await insertJobPosting(supabase, vacancy, companyResult.id, sourceId);

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
    return result;
  }
}

/**
 * Main scrape function
 */
export async function scrapeDebanensite(
  config: Partial<ScraperConfig> = {}
): Promise<ScrapeResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  console.log(
    `Starting De Banensite scraper (pages ${cfg.startPage}-${cfg.startPage + cfg.maxPagesPerRun - 1}, mode: ${cfg.mode})`
  );

  const result: ScrapeResult = {
    success: false,
    pagesProcessed: 0,
    totalFound: 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    companiesCreated: 0,
    companiesUpdated: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    errorDetails: [],
  };

  try {
    const supabase = createSupabaseClient();
    const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);

    let totalPages = 1;

    // Process pages
    for (let page = cfg.startPage; page < cfg.startPage + cfg.maxPagesPerRun; page++) {
      if (page > totalPages && totalPages > 1) break;

      const url = page === 1 ? VACATURES_URL : `${VACATURES_URL}?page=${page}`;
      console.log(`Fetching page ${page}...`);

      const html = await fetchWithRetry(url);
      const pageInfo = parseListPage(html, page);

      if (page === cfg.startPage) {
        totalPages = pageInfo.totalPages;
        console.log(`Total pages available: ${totalPages}, total vacancies: ${pageInfo.totalResults}`);
      }

      result.pagesProcessed++;
      result.totalFound += pageInfo.jobPostings.length;

      // Process each vacancy on the page
      for (const job of pageInfo.jobPostings) {
        console.log(`  Processing: ${job._source?.title || job._id}`);
        const vacancyResult = await processVacancy(supabase, job, sourceId, cfg);
        result.processed++;

        if (vacancyResult.error) {
          if (vacancyResult.error.includes("Already exists")) {
            result.skipped++;
          } else {
            result.errors++;
            result.errorDetails.push({
              uuid: vacancyResult.uuid,
              title: vacancyResult.title,
              error: vacancyResult.error,
            });
            console.error(`    Error: ${vacancyResult.error}`);
          }
        } else {
          result.inserted++;
          if (vacancyResult.companyCreated) result.companiesCreated++;
          if (vacancyResult.companyUpdated) result.companiesUpdated++;
          if (vacancyResult.contactCreated) result.contactsCreated++;
          if (vacancyResult.contactUpdated) result.contactsUpdated++;
          console.log(`    Inserted: ${vacancyResult.title}`);
        }
      }

      // Delay between pages
      await delay(cfg.delayBetweenPages);
    }

    // Set resume point for next run
    const nextPage = cfg.startPage + cfg.maxPagesPerRun;
    if (nextPage <= totalPages) {
      result.resumeFromPage = nextPage;
    }

    result.success = true;
    console.log(
      `Scraping complete: ${result.inserted} inserted, ${result.skipped} skipped, ${result.errors} errors`
    );
    console.log(
      `Companies: ${result.companiesCreated} created, ${result.companiesUpdated} updated | Contacts: ${result.contactsCreated} created, ${result.contactsUpdated} updated`
    );
  } catch (error) {
    console.error("Scraper failed:", error);
    result.success = false;
  }

  return result;
}
