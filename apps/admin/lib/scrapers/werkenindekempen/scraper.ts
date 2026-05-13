/**
 * Main orchestrator voor werkenindekempen.nl scraper.
 *
 * Flow:
 *   1. Fetch sitemap (1 request)
 *   2. Diff tegen DB: pakken alleen URLs met lastmod > last_seen_in_sitemap, max maxUrlsPerRun
 *   3. Per URL: polite fetch → parse JSON-LD → Mistral op description → 3-laagse dedup → upsert
 *   4. Na alle URLs: refresh sitemap-presence + archive delisted (3-dagen grace)
 *
 * Timeout-aware: exit gracefully wanneer < 20s over op de Vercel-functie.
 * Rate-limit-aware: stop direct bij 429/503.
 */

import {
  createSupabaseClient,
  getOrCreateJobSource,
  generateContentHash,
  type SupabaseClient,
} from "@/lib/scrapers/shared";
import {
  fetchPolite,
  humanDelay,
  newSession,
  RateLimitError,
} from "./fetch-polite";
import { parseSitemap, diffFresh, SITEMAP_URL } from "./sitemap-parser";
import {
  parseDetailHtml,
  JobPostingValidationError,
} from "./detail-parser";
import { extractFromDescription, emptyMistralResult } from "./ai-parser";
import { findOrCreateCompanyThreeLayer } from "./dedup";
import { refreshSitemapPresence } from "./delisted";
import * as N from "./normalizers";
import {
  DEFAULT_CONFIG,
  EMPTY_STATS,
  type ScraperConfig,
  type ScrapeResult,
  type MistralResult,
} from "./types";

const JOB_SOURCE_NAME = "Werken in de Kempen";

export async function scrapeWerkenindekempen(
  cfgPartial: Partial<ScraperConfig> = {}
): Promise<ScrapeResult> {
  const cfg: ScraperConfig = { ...DEFAULT_CONFIG, ...cfgPartial };
  const stats = { ...EMPTY_STATS };
  const startTime = Date.now();

  console.log(
    `[werkenindekempen] Starting (maxUrlsPerRun=${cfg.maxUrlsPerRun}, dryRun=${cfg.dryRun}, skipAI=${cfg.skipAI})`
  );

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);
  const session = newSession();

  // ── 1) Fetch sitemap ────────────────────────────────────────
  const sitemapRes = await fetchPolite(SITEMAP_URL, session, { isFirstRequest: true });
  if (!sitemapRes.html) {
    return { ...stats, success: false, errorMessage: "Empty sitemap response", duration_ms: Date.now() - startTime };
  }
  const allEntries = parseSitemap(sitemapRes.html);
  stats.sitemap_total = allEntries.length;
  console.log(`[werkenindekempen] Sitemap: ${allEntries.length} detail-URLs`);

  // ── 2) Build last-seen map uit DB + diff ────────────────────
  const lastSeenMap = await loadLastSeenMap(supabase, sourceId);
  const fresh = diffFresh(allEntries, lastSeenMap).slice(0, cfg.maxUrlsPerRun);
  stats.fresh = fresh.length;
  console.log(`[werkenindekempen] Fresh URLs to process: ${fresh.length}`);

  // ── 3) Process elke fresh URL ───────────────────────────────
  let earlyExitReason: ScrapeResult["earlyExitReason"];
  let errorMessage: string | undefined;

  for (const entry of fresh) {
    if (Date.now() - startTime > cfg.timeoutMs - 20_000) {
      earlyExitReason = "timeout";
      console.warn(`[werkenindekempen] Timeout approaching, stopping at ${stats.new + stats.skipped + stats.updated} processed`);
      break;
    }

    try {
      await humanDelay(cfg.delayMinMs, cfg.delayMaxMs, cfg.readTimeBurstChance);
      const res = await fetchPolite(entry.url, session);
      if (!res.html) {
        stats.skipped++;
        continue;
      }

      const jp = parseDetailHtml(res.html, entry.url);
      const seg = N.parseUrlSegments(entry.url);
      if (!seg) {
        stats.validation_failures++;
        console.warn(`[werkenindekempen] Bad URL pattern: ${entry.url}`);
        continue;
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
      const websiteHoofddomein = N.extractHoofddomein(jp.hiringOrganization.sameAs ?? null);

      // Mistral
      let ai: MistralResult = emptyMistralResult();
      if (!cfg.skipAI) {
        stats.mistral_calls++;
        ai = await extractFromDescription(plain, websiteHoofddomein);
      }

      if (cfg.dryRun) {
        stats.new++;
        console.log(`[werkenindekempen] [dryRun] Would insert: ${jp.title} @ ${jp.hiringOrganization.name} (${city})`);
        continue;
      }

      // Dedup company
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
      if (dedup.matchedLayer === "new") stats.companies_created++;
      else stats.companies_matched++;
      if (dedup.conflict) {
        console.warn(`[werkenindekempen] Dedup conflict on ${entry.url}: ${dedup.conflict}`);
      }

      // Upsert job_posting
      const contentHash = generateContentHash(
        jp.title,
        jp.hiringOrganization.name,
        city ?? "",
        entry.url
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
              job_type: employment.types,
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
          stats.updated++;
        } else {
          // No change — refresh last_seen_in_sitemap only
          await supabase
            .from("job_postings")
            .update({ last_seen_in_sitemap: now })
            .eq("id", existing.id);
          stats.skipped++;
        }
      } else {
        const { error } = await supabase.from("job_postings").insert({
          title: jp.title,
          company_id: dedup.id,
          source_id: sourceId,
          external_vacancy_id: seg.jobId,
          url: entry.url,
          description: jp.description,
          city,
          state: region,
          country,
          zipcode: postalCode,
          street: jp.jobLocation.address.streetAddress ?? null,
          job_type: employment.types,
          employment: employment.label,
          salary: salary.displayLabel,
          published_at: publishedAt,
          created_at: publishedAt,
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
        if (error) throw new Error(`Insert job_posting failed: ${error.message}`);
        stats.new++;

        // Contact (alleen bij echte hit met email of phone)
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
          stats.contacts_created++;
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        earlyExitReason = "rate_limited";
        errorMessage = err.message;
        console.error(`[werkenindekempen] ${err.message} — stopping`);
        break;
      }
      if (err instanceof JobPostingValidationError) {
        stats.validation_failures++;
        console.warn(`[werkenindekempen] Validation fail: ${err.message.slice(0, 200)}`);
        continue;
      }
      stats.errors++;
      console.error(`[werkenindekempen] Error on ${entry.url}:`, err);
    }
  }

  // ── 4) Refresh sitemap presence + archive delisted ───────────
  if (!cfg.dryRun && !earlyExitReason) {
    try {
      const allUrls = allEntries.map((e) => e.url);
      const { archived } = await refreshSitemapPresence(supabase, sourceId, allUrls);
      stats.delisted = archived;
      console.log(`[werkenindekempen] Delisted-check: ${archived} archived`);
    } catch (err) {
      console.error(`[werkenindekempen] refreshSitemapPresence failed:`, err);
      stats.errors++;
    }
  }

  const duration_ms = Date.now() - startTime;
  console.log(
    `[werkenindekempen] Done in ${duration_ms}ms — new:${stats.new} updated:${stats.updated} skipped:${stats.skipped} errors:${stats.errors} delisted:${stats.delisted}`
  );

  return {
    ...stats,
    success: !errorMessage && stats.errors < stats.fresh,
    earlyExitReason,
    errorMessage,
    duration_ms,
  };
}

/**
 * Bouw url → last_seen_in_sitemap map uit DB.
 * Wordt gebruikt om te bepalen welke sitemap-URLs "fresh" zijn t.o.v. wat we al kennen.
 *
 * Voor URLs die nog NIET in DB staan: returnt geen entry → diffFresh ziet ze als nieuw.
 */
async function loadLastSeenMap(
  supabase: SupabaseClient,
  sourceId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("job_postings")
      .select("url, last_seen_in_sitemap")
      .eq("source_id", sourceId)
      .not("url", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`loadLastSeenMap: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ url: string; last_seen_in_sitemap: string | null }>) {
      map.set(row.url, row.last_seen_in_sitemap ?? "");
    }
    if (data.length < pageSize) break;
    page++;
  }
  return map;
}
