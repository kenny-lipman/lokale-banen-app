// @auth SECRET
/**
 * werk.nl lijst-scan.
 *
 * POST (manual): scant tot `maxPages`. body: { maxPages?, keywords?, location?, incremental?, stopAfterKnownPages? }
 * GET (cron): incrementeel - stopt na N opeenvolgende pagina's met enkel reeds-bekende vacatures.
 *
 * Bootstrapt een anonieme OAM-sessie, pagineert de publieke zoek-API op nieuwste,
 * upsert elke vacature als minimale job_postings rij (ververst `last_seen`), en
 * enqueuet nieuwe in de detail-queue. Archiveert NOOIT (dat doet de volledige pass,
 * zie full-pass route + ADR 0002). Geen needs_detail_scrape (ADR 0001).
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/auth-middleware";
import {
  createSupabaseClient,
  getOrCreateJobSource,
  updateJobSourceStatus,
} from "@/lib/scrapers/shared";
import { bootstrapSession } from "@/lib/scrapers/werk_nl/session";
import { searchPage } from "@/lib/scrapers/werk_nl/search-client";
import { upsertListing, type UpsertOutcome } from "@/lib/scrapers/werk_nl/upsert";
import { enqueue } from "@/lib/scrapers/werk_nl/queue";
import { pageAllKnown, shouldStopIncremental } from "@/lib/scrapers/werk_nl/incremental";
import { JOB_SOURCE_NAME, PAGE_SIZE } from "@/lib/scrapers/werk_nl/constants";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

const DEFAULT_MAX_PAGES = 5;
const INCREMENTAL_MAX_PAGES = 1000; // hoge cap; early-stop beeindigt eerder
const DEFAULT_STOP_AFTER_KNOWN_PAGES = 2;

interface ScanBody {
  maxPages?: number;
  keywords?: string;
  location?: string;
  incremental?: boolean;
  stopAfterKnownPages?: number;
}

/**
 * Lijst-scan. `defaultIncremental=true` (cron-GET) stopt na N opeenvolgende pagina's
 * met enkel reeds-bekende vacatures; `false` (manual POST) scant tot maxPages.
 */
async function runScan(req: NextRequest, defaultIncremental: boolean): Promise<NextResponse> {
  const startTime = Date.now();
  let body: ScanBody = {};
  try {
    body = await req.json();
  } catch {
    /* lege body is toegestaan (cron-GET) */
  }
  const incremental = body.incremental ?? defaultIncremental;
  const stopThreshold = Math.max(1, body.stopAfterKnownPages ?? DEFAULT_STOP_AFTER_KNOWN_PAGES);
  const maxPages = incremental
    ? INCREMENTAL_MAX_PAGES
    : Math.max(1, Math.min(body.maxPages ?? DEFAULT_MAX_PAGES, 1000));
  const keywords = body.keywords ?? "";
  const location = body.location ?? "";

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);

  let newCount = 0;
  let seenCount = 0;
  let total = 0;
  let pagesScanned = 0;
  let stoppedEarly = false;
  let consecutiveKnownPages = 0;
  // Nieuwe vacatures verzamelen om in de detail-queue te zetten (Fase 2).
  const newIds: string[] = [];
  const orchestrationId = `werknl-${crypto.randomUUID()}`;
  try {
    const session = await bootstrapSession();
    const nowIso = new Date().toISOString();

    for (let page = 1; page <= maxPages; page++) {
      const { items, total: t } = await searchPage(session, page, keywords, location);
      total = t;
      if (items.length === 0) break;
      pagesScanned++;
      const outcomes: UpsertOutcome[] = [];
      for (const item of items) {
        const { jobPostingId, outcome } = await upsertListing(supabase, item, sourceId, nowIso);
        outcomes.push(outcome);
        if (outcome === "new") {
          newCount++;
          newIds.push(jobPostingId);
        } else {
          seenCount++;
        }
      }
      // Incrementele early-stop: tel opeenvolgende volledig-bekende pagina's.
      if (incremental) {
        consecutiveKnownPages = pageAllKnown(outcomes) ? consecutiveKnownPages + 1 : 0;
        if (shouldStopIncremental(consecutiveKnownPages, stopThreshold)) {
          stoppedEarly = true;
          break;
        }
      }
      // politeness tussen pagina's
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
    }

    // Nieuwe vacatures in de detail-queue zetten (worker verrijkt later).
    const enqueued = await enqueue(supabase, newIds, orchestrationId);

    await updateJobSourceStatus(supabase, sourceId, { success: true, count: newCount });

    console.log(
      `[werknl] lijst-scan klaar: mode=${incremental ? "incrementeel" : "manual"} pages=${pagesScanned} new=${newCount} seen=${seenCount} enqueued=${enqueued} stoppedEarly=${stoppedEarly} total=${total}`
    );
    return NextResponse.json({
      success: true,
      stats: {
        mode: incremental ? "incrementeel" : "manual",
        pages_scanned: pagesScanned,
        new: newCount,
        seen: seenCount,
        enqueued,
        stopped_early: stoppedEarly,
        total_available: total,
      },
      orchestration_id: orchestrationId,
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    await updateJobSourceStatus(supabase, sourceId, {
      success: false,
      earlyExitReason: "fatal",
      count: newCount,
    });
    console.error("[werknl] lijst-scan fataal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        stats: { new: newCount, seen: seenCount },
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// POST = manual (default volledige scan tot maxPages). GET = cron (incrementeel).
export const POST = withCronAuth((req: NextRequest) => runScan(req, false));
export const GET = withCronAuth((req: NextRequest) => runScan(req, true));
