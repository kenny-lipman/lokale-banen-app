/**
 * Backfill endpoint for debanensite.nl scraper
 *
 * GET  - Check backfill progress
 * POST - Start or resume a backfill run
 * DELETE - Reset backfill progress
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withCronMonitoring } from "@/lib/cron-monitor";
import { scrapeDebanensite, fetchWithRetry } from "@/lib/scrapers/debanensite/scraper";
import { parseListPage } from "@/lib/scrapers/debanensite/parser";

const SCRAPER_NAME = "debanensite";
const VACATURES_URL = "https://debanensite.nl/vacatures";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET - Check backfill progress
 */
async function getHandler(_request: NextRequest) {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("scraper_backfill_progress")
    .select("*")
    .eq("scraper_name", SCRAPER_NAME)
    .single();

  if (error || !data) {
    return NextResponse.json({
      status: "not_started",
      message: "No backfill in progress. POST to start one.",
    });
  }

  const percentComplete = data.total_pages > 0
    ? Math.round(((data.current_page - 1) / data.total_pages) * 100)
    : 0;

  return NextResponse.json({
    status: data.status,
    currentPage: data.current_page,
    totalPages: data.total_pages,
    percentComplete,
    stats: {
      totalInserted: data.total_inserted,
      totalSkipped: data.total_skipped,
      totalErrors: data.total_errors,
      runsCompleted: data.runs_completed,
    },
    pagesPerRun: data.pages_per_run,
    skipAI: data.skip_ai,
    startedAt: data.started_at,
    lastRunAt: data.last_run_at,
    completedAt: data.completed_at,
  });
}

/**
 * POST - Start or resume a backfill run
 */
async function postHandler(request: NextRequest) {
  const startTime = Date.now();
  const supabase = getServiceClient();
  const body = await request.json().catch(() => ({}));

  // Check existing progress
  const { data: existing } = await supabase
    .from("scraper_backfill_progress")
    .select("*")
    .eq("scraper_name", SCRAPER_NAME)
    .single();

  if (existing?.status === "completed") {
    return NextResponse.json({
      success: true,
      message: "Backfill already completed",
      stats: {
        totalInserted: existing.total_inserted,
        totalSkipped: existing.total_skipped,
        totalErrors: existing.total_errors,
        runsCompleted: existing.runs_completed,
      },
    });
  }

  if (existing?.status === "running") {
    return NextResponse.json({
      success: false,
      message: "Backfill already running. Wait for it to finish or DELETE to reset.",
    }, { status: 409 });
  }

  let record = existing;

  // Initialize if no record exists
  if (!record) {
    // Fetch page 1 to discover total pages
    const html = await fetchWithRetry(VACATURES_URL);
    const pageInfo = parseListPage(html, 1);
    const totalPages = pageInfo.totalPages;

    const pagesPerRun = body.pagesPerRun || 35;
    const skipAI = body.skipAI ?? true;

    const { data: inserted, error: insertError } = await supabase
      .from("scraper_backfill_progress")
      .insert({
        scraper_name: SCRAPER_NAME,
        status: "running",
        total_pages: totalPages,
        current_page: 1,
        pages_per_run: pagesPerRun,
        skip_ai: skipAI,
        started_at: new Date().toISOString(),
        last_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: `Failed to create backfill record: ${insertError.message}`,
      }, { status: 500 });
    }

    record = inserted;
    console.log(`Backfill initialized: ${totalPages} total pages, ${pagesPerRun} per run`);
  } else {
    // Resume: set status to running
    await supabase
      .from("scraper_backfill_progress")
      .update({
        status: "running",
        last_run_at: new Date().toISOString(),
      })
      .eq("scraper_name", SCRAPER_NAME);
  }

  try {
    const result = await scrapeDebanensite({
      startPage: record.current_page,
      maxPagesPerRun: record.pages_per_run,
      mode: "incremental",
      consecutiveSkipLimit: 0, // Don't early exit on skips during backfill
      skipAI: record.skip_ai,
      timeoutMs: 280_000,
      fetchDetailPages: true,
      delayBetweenPages: 500,
      delayBetweenDetailFetches: 200,
      delayBetweenAiCalls: 100,
    });

    // Calculate new current page
    const newCurrentPage = record.current_page + result.pagesProcessed;
    const isCompleted = newCurrentPage > record.total_pages;

    // Update progress
    await supabase
      .from("scraper_backfill_progress")
      .update({
        status: isCompleted ? "completed" : "paused",
        current_page: isCompleted ? record.total_pages : newCurrentPage,
        total_inserted: record.total_inserted + result.inserted,
        total_skipped: record.total_skipped + result.skipped,
        total_errors: record.total_errors + result.errors,
        runs_completed: record.runs_completed + 1,
        ...(isCompleted ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("scraper_name", SCRAPER_NAME);

    const percentComplete = Math.round(
      ((isCompleted ? record.total_pages : newCurrentPage - 1) / record.total_pages) * 100
    );

    return NextResponse.json({
      success: result.success,
      message: isCompleted
        ? "Backfill completed!"
        : `Run complete. ${percentComplete}% done. POST again to continue.`,
      thisRun: {
        pagesProcessed: result.pagesProcessed,
        inserted: result.inserted,
        skipped: result.skipped,
        errors: result.errors,
        earlyExitReason: result.earlyExitReason,
      },
      overall: {
        currentPage: isCompleted ? record.total_pages : newCurrentPage,
        totalPages: record.total_pages,
        percentComplete,
        totalInserted: record.total_inserted + result.inserted,
        totalSkipped: record.total_skipped + result.skipped,
        totalErrors: record.total_errors + result.errors,
        runsCompleted: record.runs_completed + 1,
      },
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Mark as failed on unrecoverable error
    await supabase
      .from("scraper_backfill_progress")
      .update({ status: "failed" })
      .eq("scraper_name", SCRAPER_NAME);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * DELETE - Reset backfill progress
 */
async function deleteHandler(_request: NextRequest) {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("scraper_backfill_progress")
    .delete()
    .eq("scraper_name", SCRAPER_NAME);

  if (error) {
    return NextResponse.json({
      success: false,
      error: `Failed to reset: ${error.message}`,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Backfill progress reset. POST to start fresh.",
  });
}

const monitored = withCronMonitoring("debanensite-backfill", "/api/scrapers/debanensite/backfill");
export const GET = monitored(getHandler);
export const POST = monitored(postHandler);
export const DELETE = monitored(deleteHandler);
