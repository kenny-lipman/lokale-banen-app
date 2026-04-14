/**
 * API Route for Nationale Vacaturebank scraper
 *
 * GET /api/scrapers/nationalevacaturebank - Trigger with defaults (Vercel Cron)
 * POST /api/scrapers/nationalevacaturebank - Trigger with custom config (manual)
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { scrapeNationaleVacaturebank } from "@/lib/scrapers/nationalevacaturebank/scraper";

export const runtime = "nodejs";
export const preferredRegion = "fra1";

const DEFAULT_CONFIG = {
  startPage: 1,
  maxPagesPerRun: 50,
  mode: "incremental" as const,
  delayBetweenPages: 2000,
  consecutiveSkipLimit: 50,
  timeoutMs: 280_000,
};

async function scrapeWithConfig(config: typeof DEFAULT_CONFIG) {
  const startTime = Date.now();

  try {
    console.log("NVB scraper triggered via API", config);

    const result = await scrapeNationaleVacaturebank(config);

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Scraping completed" : "Scraping completed with errors",
      stats: {
        pagesProcessed: result.pagesProcessed,
        totalFound: result.totalFound,
        processed: result.processed,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
        companiesCreated: result.companiesCreated,
        companiesUpdated: result.companiesUpdated,
        contactsCreated: result.contactsCreated,
        contactsUpdated: result.contactsUpdated,
        resumeFromPage: result.resumeFromPage,
        earlyExitReason: result.earlyExitReason,
      },
      errorDetails: result.errorDetails.slice(0, 10),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("NVB scraper API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Trigger scraper with default config (Vercel Cron, every 2 hours)
 */
async function getHandler(_request: NextRequest) {
  return scrapeWithConfig(DEFAULT_CONFIG);
}

/**
 * POST - Trigger scraper with custom config (manual triggers)
 */
async function postHandler(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const config = {
    startPage: body.startPage ?? DEFAULT_CONFIG.startPage,
    maxPagesPerRun: body.maxPagesPerRun ?? DEFAULT_CONFIG.maxPagesPerRun,
    mode: body.mode ?? DEFAULT_CONFIG.mode,
    delayBetweenPages: body.delayBetweenPages ?? DEFAULT_CONFIG.delayBetweenPages,
    consecutiveSkipLimit: body.consecutiveSkipLimit ?? DEFAULT_CONFIG.consecutiveSkipLimit,
    timeoutMs: body.timeoutMs ?? DEFAULT_CONFIG.timeoutMs,
  };

  return scrapeWithConfig(config);
}

const monitored = withCronMonitoring(
  "nvb-scraper",
  "/api/scrapers/nationalevacaturebank"
);
export const GET = monitored(getHandler);
export const POST = monitored(postHandler);
