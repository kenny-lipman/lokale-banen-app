/**
 * Main scraper for debanensite.nl
 *
 * Flow:
 * 1. Fetch list pages (/vacatures?page=X)
 * 2. Extract job data from __NEXT_DATA__ JSON
 * 3. For each job: extract extra fields with Mistral AI
 * 4. Insert into database with deduplication
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { parseListPage, stripHtmlTags, generateVacancyUrl, generateSlug } from "./parser";
import { extractDataWithAI } from "./ai-parser";
import type {
  ScraperConfig,
  ScrapeResult,
  ParsedVacancy,
  NextDataJobPosting,
  ProcessedVacancy,
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
};

/**
 * Create Supabase client with service role for server-side operations
 */
function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Delay helper
 */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Get or create job source
 */
async function getJobSourceId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("job_sources")
    .select("id")
    .eq("name", JOB_SOURCE_NAME)
    .single();

  if (error || !data) {
    // Create if not exists
    const { data: newSource, error: insertError } = await supabase
      .from("job_sources")
      .insert({
        name: JOB_SOURCE_NAME,
        active: true,
        scraping_method: "local",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`Failed to create job source: ${insertError.message}`);
    console.log(`Created job source: ${JOB_SOURCE_NAME}`);
    return newSource!.id;
  }

  return data.id;
}

/**
 * Check if vacancy exists
 */
async function vacancyExists(
  supabase: SupabaseClient,
  uuid: string,
  sourceId: string
): Promise<{ exists: boolean; id?: string }> {
  const { data } = await supabase
    .from("job_postings")
    .select("id")
    .eq("external_vacancy_id", uuid)
    .eq("source_id", sourceId)
    .single();

  return { exists: !!data, id: data?.id };
}

/**
 * Find or create a company
 */
async function findOrCreateCompany(
  supabase: SupabaseClient,
  companyData: {
    name: string;
    city?: string | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  sourceId: string
): Promise<{ id: string; created: boolean; updated: boolean }> {
  // Try exact match first
  const { data: existing } = await supabase
    .from("companies")
    .select("id, website, phone, city")
    .ilike("name", companyData.name)
    .single();

  if (existing) {
    // Update existing company with new data if we have more info
    const updates: Record<string, unknown> = {};
    if (companyData.website && !existing.website) updates.website = companyData.website;
    if (companyData.phone && !existing.phone) updates.phone = companyData.phone;
    if (companyData.city && !existing.city) updates.city = companyData.city;

    const wasUpdated = Object.keys(updates).length > 0;
    if (wasUpdated) {
      await supabase.from("companies").update(updates).eq("id", existing.id);
    }

    return { id: existing.id, created: false, updated: wasUpdated };
  }

  // Create new company
  const { data: newCompany, error } = await supabase
    .from("companies")
    .insert({
      name: companyData.name,
      city: companyData.city || null,
      website: companyData.website || null,
      phone: companyData.phone || null,
      source: sourceId,
      status: "Prospect",
      enrichment_status: "pending",
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (error || !newCompany) {
    throw new Error(`Failed to create company: ${error?.message || "No data returned"}`);
  }

  return { id: newCompany.id, created: true, updated: false };
}

/**
 * Create a contact for a company if contact info is available
 */
async function createContactIfAvailable(
  supabase: SupabaseClient,
  companyId: string,
  contactData: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    title?: string | null;
  }
): Promise<{ id: string; created: boolean } | null> {
  // Need at least a name or email to create a contact
  if (!contactData.name && !contactData.email) {
    return null;
  }

  // Check for existing contact by email (most reliable dedup)
  if (contactData.email) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", contactData.email)
      .single();

    if (existing) {
      return { id: existing.id, created: false };
    }
  }

  // Parse name into first/last name
  let firstName: string | null = null;
  let lastName: string | null = null;

  if (contactData.name) {
    const nameParts = contactData.name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(" ");
    } else {
      firstName = contactData.name;
    }
  }

  const { data: newContact, error } = await supabase
    .from("contacts")
    .insert({
      company_id: companyId,
      name: contactData.name || null,
      first_name: firstName,
      last_name: lastName,
      email: contactData.email || null,
      phone: contactData.phone || null,
      title: contactData.title || null,
      source: JOB_SOURCE_NAME,
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error(`Failed to create contact: ${error.message}`);
    return null;
  }

  return newContact ? { id: newContact.id, created: true } : null;
}

/**
 * Insert a job posting
 */
async function insertJobPosting(
  supabase: SupabaseClient,
  vacancy: ParsedVacancy,
  companyId: string,
  sourceId: string
): Promise<void> {
  // Parse working hours to number if possible
  let workingHoursMin: number | null = null;
  if (vacancy.working_hours) {
    const hoursMatch = vacancy.working_hours.match(/(\d+)/);
    if (hoursMatch) {
      workingHoursMin = parseInt(hoursMatch[1], 10);
    }
  }

  const { error } = await supabase.from("job_postings").insert({
    title: vacancy.title,
    company_id: companyId,
    source_id: sourceId,
    external_vacancy_id: vacancy.uuid,
    url: vacancy.url,
    description: vacancy.description,
    city: vacancy.city,
    country: "Netherlands",
    employment:
      vacancy.employment_type === "Full-time"
        ? "Fulltime"
        : vacancy.employment_type === "Part-time"
          ? "Parttime"
          : null,
    salary: vacancy.salary,
    working_hours_min: workingHoursMin,
    status: "new",
    review_status: "pending",
    scraped_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to insert job posting: ${error.message}`);
  }
}

/**
 * Process a single vacancy
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

    // Extract extra data with AI
    await delay(config.delayBetweenAiCalls);
    const aiData = await extractDataWithAI(descriptionPlain);

    // Combine all data
    const vacancy: ParsedVacancy = {
      uuid: job._id,
      url,
      title: title,
      company_name: companyName,
      city,
      coordinates,
      employment_type: employmentType,
      description: descriptionHtml,
      description_plain: descriptionPlain,
      ...aiData,
    };

    // Find or create company
    const companyResult = await findOrCreateCompany(
      supabase,
      {
        name: vacancy.company_name,
        city: vacancy.city,
        website: vacancy.company_website,
        phone: vacancy.company_phone,
        email: vacancy.company_email,
      },
      sourceId
    );

    result.companyCreated = companyResult.created;
    result.companyUpdated = companyResult.updated;

    // Create contact if info available
    const contactResult = await createContactIfAvailable(supabase, companyResult.id, {
      name: vacancy.contact_name,
      email: vacancy.contact_email,
      phone: vacancy.contact_phone,
      title: vacancy.contact_title,
    });

    result.contactCreated = contactResult?.created || false;

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
    errorDetails: [],
  };

  try {
    const supabase = createSupabaseClient();
    const sourceId = await getJobSourceId(supabase);

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
      `Companies: ${result.companiesCreated} created, ${result.companiesUpdated} updated | Contacts: ${result.contactsCreated} created`
    );
  } catch (error) {
    console.error("Scraper failed:", error);
    result.success = false;
  }

  return result;
}
