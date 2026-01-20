/**
 * API Route for debanensite.nl scraper
 *
 * POST /api/scrapers/debanensite - Trigger scraper
 * GET /api/scrapers/debanensite - Get last run status
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeDebanensite } from "@/lib/scrapers/debanensite/scraper";
import { createClient } from "@supabase/supabase-js";

const JOB_SOURCE_NAME = "De Banensite";

/**
 * Auth check - allows CRON_SECRET or development mode
 */
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET_KEY;

  // Allow if CRON_SECRET matches
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Allow from localhost in development
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

/**
 * POST - Trigger the scraper
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse optional config from body
    const body = await request.json().catch(() => ({}));
    const config = {
      startPage: body.startPage || 1,
      maxPagesPerRun: body.maxPagesPerRun || 50,
      mode: body.mode || "incremental",
      delayBetweenPages: body.delayBetweenPages || 500,
      delayBetweenAiCalls: body.delayBetweenAiCalls || 100,
    };

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
      errorDetails: result.errorDetails.slice(0, 10), // Limit error details
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

/**
 * GET - Get last scrape info
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get job source
    const { data: source } = await supabase
      .from("job_sources")
      .select("id, name, active")
      .eq("name", JOB_SOURCE_NAME)
      .single();

    if (!source) {
      return NextResponse.json({
        source: null,
        message: `Job source '${JOB_SOURCE_NAME}' not yet created. Run POST to create it.`,
        timestamp: new Date().toISOString(),
      });
    }

    // Get count and last scraped
    const { count } = await supabase
      .from("job_postings")
      .select("*", { count: "exact", head: true })
      .eq("source_id", source.id);

    const { data: lastJob } = await supabase
      .from("job_postings")
      .select("scraped_at, title")
      .eq("source_id", source.id)
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    // Get company count for this source
    const { count: companyCount } = await supabase
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("source", source.id);

    return NextResponse.json({
      source: {
        id: source.id,
        name: source.name,
        active: source.active,
      },
      stats: {
        totalVacatures: count || 0,
        totalCompanies: companyCount || 0,
        lastScrapedAt: lastJob?.scraped_at || null,
        lastVacatureTitle: lastJob?.title || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET scraper status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
