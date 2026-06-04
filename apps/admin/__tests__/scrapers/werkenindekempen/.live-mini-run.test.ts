/**
 * LIVE MINI-RUN: niet voor CI. Schrijft 1 echte vacature naar prod-DB.
 *
 * Voor laatste validatie van de full insert-pipeline.
 * Rollback bij issue: DELETE FROM job_postings WHERE source_id = (werkenindekempen) AND scraped_at >= now() - interval '5 minutes';
 *
 * Run: pnpm exec vitest run __tests__/scrapers/werkenindekempen/.live-mini-run.test.ts
 */

import { describe, test, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { scrapeWerkenindekempen } from "@/lib/scrapers/werkenindekempen/scraper";

// Guarded met existsSync zodat een ontbrekend .env.local (bijv. in CI of een
// verse worktree) niet bij collection crasht. De live-suite staat toch op
// describe.skip; deze env-load is alleen voor handmatige runs.
const envPath = resolve(__dirname, "../../../../..", ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (k && !process.env[k]) process.env[k] = v;
  }
}

describe.skip("LIVE MINI-RUN (handmatig, prod-DB write)", () => {
  test(
    "scrape 1 fresh URL met echte inserts",
    async () => {
      const result = await scrapeWerkenindekempen({
        maxUrlsPerRun: 1,
        delayMinMs: 500,
        delayMaxMs: 1_000,
        readTimeBurstChance: 0,
        timeoutMs: 280_000,
        skipAI: false,
        dryRun: false,
        skipStartJitter: true,
      });
      console.log("LIVE MINI-RUN RESULT:", JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.validation_failures).toBe(0);
      expect(result.errors).toBe(0);
      // Verwacht 1 nieuw record (of update bij re-run)
      expect(result.new + result.updated + result.skipped).toBeGreaterThanOrEqual(1);
    },
    { timeout: 60_000 }
  );
});
