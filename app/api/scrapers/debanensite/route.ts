/**
 * API Route for debanensite.nl scraper
 *
 * GET /api/scrapers/debanensite - Trigger scraper with defaults (Vercel Cron)
 * POST /api/scrapers/debanensite - Trigger scraper with custom config (manual)
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { scrapeDebanensite } from "@/lib/scrapers/debanensite/scraper";

const DEFAULT_CONFIG = {
  startPage: 1,
  maxPagesPerRun: 50,
  mode: "incremental" as const,
  delayBetweenPages: 500,
  delayBetweenAiCalls: 100,
};

async function scrapeWithConfig(config: typeof DEFAULT_CONFIG) {
  const startTime = Date.now();

  try {
    console.log("De Banensite scraper triggered via API", config);

    const result = await scrapeDebanensite(config);

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Scraping completed" : "Scraping failed",
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
        resumeFromPage: result.resumeFromPage,
      },
      errorDetails: result.errorDetails.slice(0, 10),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scraper API error:", error);
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
 * GET - Trigger scraper with default config (Vercel Cron)
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
    startPage: body.startPage || DEFAULT_CONFIG.startPage,
    maxPagesPerRun: body.maxPagesPerRun || DEFAULT_CONFIG.maxPagesPerRun,
    mode: body.mode || DEFAULT_CONFIG.mode,
    delayBetweenPages: body.delayBetweenPages || DEFAULT_CONFIG.delayBetweenPages,
    delayBetweenAiCalls: body.delayBetweenAiCalls || DEFAULT_CONFIG.delayBetweenAiCalls,
  };

  return scrapeWithConfig(config);
}

// GET for Vercel Cron, POST for manual triggers with custom config
const monitored = withCronMonitoring('debanensite-scraper', '/api/scrapers/debanensite');
export const GET = monitored(getHandler);
export const POST = monitored(postHandler);
