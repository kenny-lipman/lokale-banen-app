/**
 * Process één werkenindekempen.nl vacature-URL.
 *
 * Gedeeld tussen:
 * - oude in-functie scraper (scraper.ts, fallback/tests)
 * - nieuwe worker route (Fase 2 orchestrator/worker pattern)
 *
 * Throws: RateLimitError, JobPostingValidationError, generieke errors.
 * Returns: per-URL outcome zodat caller stats kan aggregeren.
 */

import {
  generateContentHash,
  type SupabaseClient,
} from "@/lib/scrapers/shared";
import { fetchPolite, type FetchSession } from "./fetch-polite";
import { parseDetailHtml } from "./detail-parser";
import { extractFromDescription, emptyMistralResult } from "./ai-parser";
import { findOrCreateCompanyThreeLayer } from "./dedup";
import * as N from "./normalizers";
import type { MistralResult } from "./types";

export type ProcessOutcome =
  | "new"
  | "updated"
  | "skipped"
  | "validation_failed"
  | "dry_run";

export interface ProcessResult {
  outcome: ProcessOutcome;
  mistralCalled: boolean;
  companyCreated: boolean;
  companyMatched: boolean;
  contactCreated: boolean;
  /** Voor logging — wanneer dedup een conflict gaf maar wel match vond */
  dedupConflict?: string | null;
}

export interface ProcessOptions {
  skipAI: boolean;
  dryRun: boolean;
}

export async function processOne(
  supabase: SupabaseClient,
  session: FetchSession,
  sourceId: string,
  url: string,
  opts: ProcessOptions
): Promise<ProcessResult> {
  const res = await fetchPolite(url, session);
  if (!res.html) {
    return {
      outcome: "skipped",
      mistralCalled: false,
      companyCreated: false,
      companyMatched: false,
      contactCreated: false,
    };
  }

  const jp = parseDetailHtml(res.html, url);
  const seg = N.parseUrlSegments(url);
  if (!seg) {
    return {
      outcome: "validation_failed",
      mistralCalled: false,
      companyCreated: false,
      companyMatched: false,
      contactCreated: false,
    };
  }

  const city = N.normalizeCity(jp.jobLocation.address.addressLocality);
  const region = N.normalizeRegion(jp.jobLocation.address.addressRegion ?? null);
  const country = N.normalizeCountry(jp.jobLocation.address.addressCountry ?? null);
  const employment = N.normalizeEmploymentType(jp.employmentType);
  const salary = N.parseSalary(jp.baseSalary);
  const postalCode = N.normalizePostalCode(jp.jobLocation.address.postalCode ?? null);
  const publishedAt = N.parsePublishedAt(jp.datePosted);
  const endDate = jp.validThrough ? jp.validThrough.slice(0, 10) : null;
  const plain = N.stripHtml(jp.description ?? "");

  let ai: MistralResult = emptyMistralResult();
  let mistralCalled = false;
  if (!opts.skipAI) {
    mistralCalled = true;
    ai = await extractFromDescription(plain);
  }

  if (opts.dryRun) {
    return {
      outcome: "dry_run",
      mistralCalled,
      companyCreated: false,
      companyMatched: false,
      contactCreated: false,
    };
  }

  const dedup = await findOrCreateCompanyThreeLayer(
    supabase,
    {
      werkenindekempen_id: `c${seg.companyExtId}`,
      name: jp.hiringOrganization.name,
      website: jp.hiringOrganization.sameAs ?? null,
      logo_url: jp.hiringOrganization.logo ?? null,
      city,
      state: region,
      country,
      street_address: jp.jobLocation.address.streetAddress ?? null,
      postal_code: postalCode,
      location: city,
    },
    sourceId
  );

  const contentHash = generateContentHash(
    jp.title,
    jp.hiringOrganization.name,
    city ?? "",
    url
  );
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("job_postings")
    .select("id, content_hash")
    .eq("external_vacancy_id", seg.jobId)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (existing) {
    if (existing.content_hash !== contentHash) {
      const { error } = await supabase
        .from("job_postings")
        .update({
          title: jp.title,
          description: jp.description,
          salary: salary.displayLabel,
          employment: employment.label,
          job_type: employment.labels,
          content_hash: contentHash,
          last_seen_in_sitemap: now,
          education_level: ai.education_level,
          career_level: ai.career_level,
          working_hours_min: ai.working_hours_min,
          working_hours_max: ai.working_hours_max,
          categories: ai.categories.join(", ") || null,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) throw new Error(`Update job_posting failed: ${error.message}`);
      return {
        outcome: "updated",
        mistralCalled,
        companyCreated: dedup.matchedLayer === "new",
        companyMatched: dedup.matchedLayer !== "new",
        contactCreated: false,
        dedupConflict: dedup.conflict,
      };
    }
    // No change — refresh last_seen_in_sitemap only
    await supabase
      .from("job_postings")
      .update({ last_seen_in_sitemap: now })
      .eq("id", existing.id);
    return {
      outcome: "skipped",
      mistralCalled,
      companyCreated: dedup.matchedLayer === "new",
      companyMatched: dedup.matchedLayer !== "new",
      contactCreated: false,
      dedupConflict: dedup.conflict,
    };
  }

  const { error: insertErr } = await supabase.from("job_postings").insert({
    title: jp.title,
    company_id: dedup.id,
    source_id: sourceId,
    external_vacancy_id: seg.jobId,
    url,
    description: jp.description,
    city,
    state: region,
    country,
    zipcode: postalCode,
    street: jp.jobLocation.address.streetAddress ?? null,
    job_type: employment.labels,
    employment: employment.label,
    salary: salary.displayLabel,
    published_at: publishedAt,
    end_date: endDate,
    scraped_at: now,
    content_hash: contentHash,
    last_seen_in_sitemap: now,
    status: "new",
    review_status: "pending",
    education_level: ai.education_level,
    career_level: ai.career_level,
    working_hours_min: ai.working_hours_min,
    working_hours_max: ai.working_hours_max,
    categories: ai.categories.join(", ") || null,
  });
  if (insertErr) throw new Error(`Insert job_posting failed: ${insertErr.message}`);

  let contactCreated = false;
  if (ai.contact && (ai.contact.email || ai.contact.phone)) {
    const name =
      [ai.contact.first_name, ai.contact.last_name].filter(Boolean).join(" ") || null;
    await supabase.from("contacts").insert({
      company_id: dedup.id,
      first_name: ai.contact.first_name,
      last_name: ai.contact.last_name,
      name,
      email: ai.contact.email,
      phone: ai.contact.phone,
      title: ai.contact.title,
      source: "werkenindekempen.nl",
      status: "new",
      qualification_status: "pending",
      contact_priority: 5,
    });
    contactCreated = true;
  }

  return {
    outcome: "new",
    mistralCalled,
    companyCreated: dedup.matchedLayer === "new",
    companyMatched: dedup.matchedLayer !== "new",
    contactCreated,
    dedupConflict: dedup.conflict,
  };
}
