/**
 * Types + Zod-schemas voor werkenindekempen.nl scraper.
 *
 * - JobPostingLDSchema: Strict validation van Schema.org JSON-LD JobPosting
 * - MistralResultSchema: AI-extractie output (contact, working_hours, etc.)
 * - ScraperStats: business_stats keys (matchen met automations-registry displayStats)
 * - ScraperConfig: runtime tuning
 */

import { z } from "zod";

// ── JSON-LD JobPosting ─────────────────────────────────────────────

/**
 * Helper: optional string die ook expliciete `null` accepteert.
 * JSON-LD bronnen schrijven vaak `"foo": null` ipv het veld weg te laten.
 */
const nullableString = () => z.string().nullable().optional();
// Voor URL-velden (sameAs/logo): we doen GEEN .url() check.
// Reden: werkenindekempen.nl publiceert soms bare domains, lege strings, of relative paths.
// Strikte URL-validatie skipped vacatures onnodig.
// Downstream gebruiken we extractHoofddomein() die zelf protocol-handling doet.
const nullableUrl = () => z.string().nullable().optional();

export const AddressSchema = z.object({
  "@type": z.literal("PostalAddress").optional(),
  streetAddress: nullableString(),
  postalCode: nullableString(),
  addressLocality: z.string().min(1),
  addressRegion: z.string().max(20).nullable().optional(),
  addressCountry: nullableString(),
});

export const HiringOrgSchema = z.object({
  "@type": z.literal("Organization").optional(),
  name: z.string().min(1),
  sameAs: nullableUrl(),
  logo: nullableUrl(),
});

export const BaseSalarySchema = z
  .object({
    "@type": z.literal("MonetaryAmount").optional(),
    currency: z.string().nullable().optional(),
    value: z
      .object({
        "@type": z.literal("QuantitativeValue").optional(),
        value: z.union([z.string(), z.number()]).nullable().optional(),
        minValue: z.number().nullable().optional(),
        maxValue: z.number().nullable().optional(),
        unitText: z.enum(["HOUR", "WEEK", "MONTH", "YEAR"]).nullable().optional(),
      })
      .nullable()
      .optional(),
    unitText: z.enum(["HOUR", "WEEK", "MONTH", "YEAR"]).nullable().optional(),
  })
  .nullable()
  .optional();

export const JobPostingLDSchema = z.object({
  "@type": z.literal("JobPosting"),
  title: z.string().min(2),
  datePosted: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "datePosted must be ISO-date"),
  validThrough: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional(),
  // employmentType komt als JSON-string-array (bv "[\"FULL_TIME\",\"PART_TIME\"]") of als echte array
  employmentType: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  description: z.string().optional().default(""),
  hiringOrganization: HiringOrgSchema,
  jobLocation: z.object({
    "@type": z.literal("Place").optional(),
    address: AddressSchema,
  }),
  baseSalary: BaseSalarySchema,
  occupationalCategory: z.string().nullable().optional(),
});
export type JobPostingLD = z.infer<typeof JobPostingLDSchema>;

// ── Mistral extraction result ──────────────────────────────────────

export const EducationLevelEnum = z.enum([
  "MBO",
  "HBO",
  "WO",
  "VMBO",
  "HAVO",
  "VWO",
  "PhD",
  "Geen",
  "Onbekend",
]);
export const CareerLevelEnum = z.enum([
  "Junior",
  "Medior",
  "Senior",
  "Lead",
  "Manager",
  "Director",
  "Stage",
  "Onbekend",
]);

export const MistralContactSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  title: z.string().nullable(),
});

export const MistralResultSchema = z.object({
  contact: MistralContactSchema.nullable(),
  working_hours_min: z.number().int().min(1).max(80).nullable(),
  working_hours_max: z.number().int().min(1).max(80).nullable(),
  education_level: EducationLevelEnum.nullable(),
  career_level: CareerLevelEnum.nullable(),
  categories: z.array(z.string()).max(3).default([]),
});
export type MistralResult = z.infer<typeof MistralResultSchema>;
export type MistralContact = z.infer<typeof MistralContactSchema>;

// ── Scraper stats (mapt naar cron_job_logs.business_stats) ─────────

export interface ScraperStats {
  sitemap_total: number;
  fresh: number;
  new: number;
  updated: number;
  skipped: number;
  errors: number;
  companies_created: number;
  companies_matched: number;
  contacts_created: number;
  mistral_calls: number;
  delisted: number;
  validation_failures: number;
  /** Aantal workers dat completed klaar werd (alleen gevuld door finalizer in Fase 2). */
  workers_completed?: number;
  /** Aantal queue-rijen nog pending+processing (Fase 2). */
  queue_remaining?: number;
  duration_ms?: number;
}

export const EMPTY_STATS: ScraperStats = {
  sitemap_total: 0,
  fresh: 0,
  new: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  companies_created: 0,
  companies_matched: 0,
  contacts_created: 0,
  mistral_calls: 0,
  delisted: 0,
  validation_failures: 0,
  workers_completed: 0,
  queue_remaining: 0,
};

// ── Scraper config ─────────────────────────────────────────────────

export interface ScraperConfig {
  maxUrlsPerRun: number;
  delayMinMs: number;
  delayMaxMs: number;
  readTimeBurstChance: number;
  timeoutMs: number;
  skipAI: boolean;
  dryRun: boolean;
  /** Skip jitter aan start (gebruikt voor manual triggers + tests) */
  skipStartJitter?: boolean;
}

export const DEFAULT_CONFIG: ScraperConfig = {
  maxUrlsPerRun: 200,
  delayMinMs: 2_000,
  delayMaxMs: 5_000,
  readTimeBurstChance: 0.15,
  timeoutMs: 280_000,
  skipAI: false,
  dryRun: false,
};

export interface ScrapeResult extends ScraperStats {
  success: boolean;
  earlyExitReason?: "timeout" | "rate_limited" | "fatal";
  errorMessage?: string;
}
