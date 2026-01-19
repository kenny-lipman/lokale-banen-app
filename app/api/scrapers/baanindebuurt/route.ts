/**
 * API Route for Baanindebuurt.nl scraper
 *
 * POST /api/scrapers/baanindebuurt - Trigger scraper
 * GET /api/scrapers/baanindebuurt - Get last run status
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeBaanindebuurt } from "@/lib/scrapers/baanindebuurt/scraper";
import { createClient } from "@supabase/supabase-js";

// Simple auth check - can be expanded with proper auth
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

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
  // Auth check
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Baanindebuurt scraper triggered via API");

    // Run scraper
    const result = await scrapeBaanindebuurt();

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
      .eq("name", "Baan in de Buurt")
      .single();

    if (!source) {
      return NextResponse.json({ error: "Job source not found" }, { status: 404 });
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

    return NextResponse.json({
      source: {
        id: source.id,
        name: source.name,
        active: source.active,
      },
      stats: {
        totalVacatures: count || 0,
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
