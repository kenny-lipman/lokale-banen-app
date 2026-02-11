/**
 * API Route for Baanindebuurt.nl scraper
 *
 * GET /api/scrapers/baanindebuurt - Trigger scraper (Vercel Cron)
 * POST /api/scrapers/baanindebuurt - Trigger scraper (manual)
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { scrapeBaanindebuurt } from "@/lib/scrapers/baanindebuurt/scraper";

async function scrapeHandler(_request: NextRequest) {
  try {
    console.log("Baanindebuurt scraper triggered via API");

    const result = await scrapeBaanindebuurt();

    // Collect per-PDF error details for debugging
    const errorDetails = result.details
      .filter((d) => d.error && !d.error.includes("Already exists"))
      .map((d) => ({
        pdfId: d.pdfId,
        pdfUrl: d.pdfUrl,
        error: d.error,
        textLength: d.rawText?.length ?? 0,
      }));

    return NextResponse.json({
      success: result.success,
      message: result.success ? "Scraping completed" : "Scraping failed",
      stats: {
        totalFound: result.totalFound,
        processed: result.processed,
        inserted: result.inserted,
        skipped: result.skipped,
        errors: result.errors,
        companiesCreated: result.companiesCreated,
        companiesUpdated: result.companiesUpdated,
        contactsCreated: result.contactsCreated,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Scraper API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET for Vercel Cron, POST for manual triggers
const monitored = withCronMonitoring('baanindebuurt-scraper', '/api/scrapers/baanindebuurt');
export const GET = monitored(scrapeHandler);
export const POST = monitored(scrapeHandler);
