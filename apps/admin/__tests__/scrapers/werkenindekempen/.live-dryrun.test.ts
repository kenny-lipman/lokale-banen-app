/**
 * LIVE DRY-RUN — niet voor CI.
 *
 * Roept de echte scraper aan met `dryRun: true` tegen werkenindekempen.nl + Mistral.
 * Schrijft NIETS naar job_postings/companies/contacts.
 * Wel: eerste keer maakt het een job_sources-row aan voor "Werken in de Kempen".
 *
 * Run handmatig: pnpm exec vitest run __tests__/scrapers/werkenindekempen/.live-dryrun.test.ts
 *
 * Bestandsnaam start met "." zodat vitest deze niet automatisch oppakt in CI.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { scrapeWerkenindekempen } from "@/lib/scrapers/werkenindekempen/scraper";

// Laad .env.local
const envPath = resolve(__dirname, "../../../../..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx < 0) continue;
  const k = line.slice(0, idx).trim();
  const v = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
  if (k && !process.env[k]) process.env[k] = v;
}

describe.skip("LIVE DRY-RUN (handmatig, niet in CI)", () => {
  test(
    "scrape 3 fresh URLs met dryRun + Mistral",
    async () => {
      const result = await scrapeWerkenindekempen({
        maxUrlsPerRun: 3,
        delayMinMs: 1_000,
        delayMaxMs: 2_000,
        readTimeBurstChance: 0,
        timeoutMs: 280_000,
        skipAI: false,
        dryRun: true,
        skipStartJitter: true,
      });
      console.log("LIVE DRY-RUN RESULT:", JSON.stringify(result, null, 2));
      expect(result.sitemap_total).toBeGreaterThan(500);
      expect(result.fresh).toBeGreaterThanOrEqual(0);
      expect(result.validation_failures).toBe(0);
      expect(result.errors).toBe(0);
    },
    { timeout: 60_000 }
  );
});
