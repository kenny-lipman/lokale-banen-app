/**
 * Main scraper for Nationale Vacaturebank
 *
 * Flow:
 * 1. Fetch pages from NVB API (sorted by date, newest first)
 * 2. Parse structured JSON responses (no AI needed)
 * 3. For each job: dedup → create company → insert job → create contact
 * 4. In incremental mode: stop after N consecutive known jobs
 * 5. Timeout-aware: stops before Vercel 300s limit
 */

import {
  createSupabaseClient,
  getOrCreateJobSource,
  vacancyExists,
  findOrCreateCompany,
  findOrCreateContact,
  delay,
  type SupabaseClient,
} from "../shared";
import { fetchPage } from "./api-client";
import { parseJob, type ParsedJob } from "./parser";
import type { ScraperConfig, ScrapeResult } from "./types";

const JOB_SOURCE_NAME = "Nationale Vacaturebank";

const DEFAULT_CONFIG: ScraperConfig = {
  maxPagesPerRun: 50,
  startPage: 1,
  mode: "incremental",
  delayBetweenPages: 2000,
  consecutiveSkipLimit: 50,
  timeoutMs: 280_000,
};

/**
 * Process a single parsed job: company → job posting → contact
 */
async function processJob(
  supabase: SupabaseClient,
  job: ParsedJob,
  sourceId: string,
  stats: ScrapeResult
): Promise<"inserted" | "skipped"> {
  // Check if job already exists
  const existing = await vacancyExists(supabase, job.external_vacancy_id, sourceId);
  if (existing.exists) {
    stats.skipped++;
    return "skipped";
  }

  // Find or create company
  const companyResult = await findOrCreateCompany(
    supabase,
    {
      name: job.company_name,
      city: job.city || null,
      location: job.location || null,
      street_address: job.street || null,
      postal_code: job.zipcode || null,
      website: job.company_website,
    },
    sourceId
  );

  if (companyResult.created) stats.companiesCreated++;
  if (companyResult.updated) stats.companiesUpdated++;

  // Insert job posting
  const { error: insertError } = await supabase.from("job_postings").insert({
    title: job.title,
    company_id: companyResult.id,
    url: job.url,
    description: job.description,
    employment: job.employment,
    job_type: job.job_type,
    salary: job.salary,
    working_hours_min: job.working_hours_min,
    working_hours_max: job.working_hours_max,
    education_level: job.education_level,
    career_level: job.career_level,
    categories: job.categories,
    location: job.location,
    city: job.city,
    zipcode: job.zipcode,
    street: job.street,
    latitude: job.latitude,
    longitude: job.longitude,
    country: "Nederland",
    status: "new",
    source_id: sourceId,
    external_vacancy_id: job.external_vacancy_id,
    content_hash: job.content_hash,
    end_date: job.end_date || null,
    created_at: job.start_date || new Date().toISOString(),
    scraped_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  stats.inserted++;

  // Create contact if email or phone available
  if (job.contact_email || job.contact_phone) {
    const contactResult = await findOrCreateContact(
      supabase,
      companyResult.id,
      {
        name: "Afdeling Personeelszaken",
        email: job.contact_email,
        phone: job.contact_phone,
      },
      "Scraper"
    );

    if (contactResult?.created) stats.contactsCreated++;
    if (contactResult?.updated) stats.contactsUpdated++;
  }

  return "inserted";
}

/**
 * Main scraper entry point
 */
export async function scrapeNationaleVacaturebank(
  config: Partial<ScraperConfig> = {}
): Promise<ScrapeResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const stats: ScrapeResult = {
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
    resumeFromPage: null,
    earlyExitReason: null,
    errorDetails: [],
  };

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME, "local");
  let consecutiveSkips = 0;

  console.log(`NVB scraper starting: mode=${cfg.mode}, pages=${cfg.startPage}-${cfg.startPage + cfg.maxPagesPerRun - 1}`);

  for (let page = cfg.startPage; page < cfg.startPage + cfg.maxPagesPerRun; page++) {
    // Timeout check — leave 20s buffer for final DB operations
    const elapsed = Date.now() - startTime;
    if (elapsed > cfg.timeoutMs - 20_000) {
      stats.earlyExitReason = `timeout at ${Math.round(elapsed / 1000)}s`;
      stats.resumeFromPage = page;
      console.log(`NVB scraper: ${stats.earlyExitReason}, resume from page ${page}`);
      break;
    }

    try {
      const response = await fetchPage(page);
      const jobs = response._embedded?.jobs || [];

      if (jobs.length === 0) {
        stats.earlyExitReason = `empty page ${page}`;
        console.log(`NVB scraper: no jobs on page ${page}, stopping`);
        break;
      }

      stats.totalFound += jobs.length;
      stats.pagesProcessed++;

      for (const rawJob of jobs) {
        const parsed = parseJob(rawJob);
        if (!parsed) {
          stats.errors++;
          continue;
        }

        stats.processed++;

        try {
          const result = await processJob(supabase, parsed, sourceId, stats);

          if (result === "skipped") {
            consecutiveSkips++;
          } else {
            consecutiveSkips = 0;
          }

          // In incremental mode, stop after too many consecutive known jobs
          if (
            cfg.mode === "incremental" &&
            consecutiveSkips >= cfg.consecutiveSkipLimit
          ) {
            stats.earlyExitReason = `${consecutiveSkips} consecutive known jobs on page ${page}`;
            console.log(`NVB scraper: ${stats.earlyExitReason}, stopping`);
            break;
          }
        } catch (error) {
          stats.errors++;
          const msg = `Job ${parsed.external_vacancy_id}: ${error instanceof Error ? error.message : String(error)}`;
          if (stats.errorDetails.length < 10) {
            stats.errorDetails.push(msg);
          }
          console.error(`NVB scraper error: ${msg}`);
        }
      }

      // Break outer loop if inner loop triggered early exit
      if (stats.earlyExitReason) break;

      // Rate limiting between pages
      if (page < cfg.startPage + cfg.maxPagesPerRun - 1) {
        await delay(cfg.delayBetweenPages);
      }
    } catch (error) {
      stats.errors++;
      const msg = `Page ${page}: ${error instanceof Error ? error.message : String(error)}`;
      stats.errorDetails.push(msg);
      console.error(`NVB scraper page error: ${msg}`);
      // Continue to next page on fetch error
    }
  }

  stats.success = stats.errors < stats.processed;

  console.log(
    `NVB scraper done: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors} errors, ${stats.pagesProcessed} pages in ${Math.round((Date.now() - startTime) / 1000)}s`
  );

  return stats;
}
