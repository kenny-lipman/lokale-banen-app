/**
 * API Route voor werkenindekempen.nl scraper.
 *
 * GET  /api/scrapers/werkenindekempen        — Vercel Cron trigger (DEFAULT_CONFIG)
 * POST /api/scrapers/werkenindekempen        — Manual met custom config (body als JSON)
 *
 * Runtime: nodejs (geen Edge — Mistral SDK + Supabase service-role)
 * Region: fra1/ams1 (EU, niet AWS-us → minder verdacht IP-pattern voor NL-site)
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { scrapeWerkenindekempen } from "@/lib/scrapers/werkenindekempen/scraper";
import { DEFAULT_CONFIG, type ScraperConfig } from "@/lib/scrapers/werkenindekempen/types";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

const CRON_DEFAULTS: ScraperConfig = { ...DEFAULT_CONFIG };

/** Random jitter 0-30 min aan start van cron-run zodat we niet exact om 07:30 vuren. */
const MAX_JITTER_MS = 30 * 60 * 1000;

async function runWithConfig(
  cfg: ScraperConfig,
  options: { applyStartJitter?: boolean } = {}
) {
  const startTime = Date.now();
  try {
    if (options.applyStartJitter && !cfg.skipStartJitter) {
      const jitterMs = Math.random() * MAX_JITTER_MS;
      console.log(`[werkenindekempen] Start jitter: ${Math.round(jitterMs / 1000)}s`);
      await new Promise((r) => setTimeout(r, jitterMs));
    }
    const stats = await scrapeWerkenindekempen(cfg);
    return NextResponse.json({
      success: stats.success,
      message: stats.success ? "Scraping completed" : "Scraping completed with errors",
      stats,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[werkenindekempen] Fatal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

async function getHandler(_req: NextRequest) {
  return runWithConfig(CRON_DEFAULTS, { applyStartJitter: true });
}

async function postHandler(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const cfg: ScraperConfig = { ...CRON_DEFAULTS, ...body };
  return runWithConfig(cfg, { applyStartJitter: false });
}

const monitored = withCronMonitoring(
  "werkenindekempen-scraper",
  "/api/scrapers/werkenindekempen"
);
export const GET = monitored(getHandler);
export const POST = monitored(postHandler);
