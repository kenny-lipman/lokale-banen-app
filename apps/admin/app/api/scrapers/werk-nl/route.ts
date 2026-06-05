// @auth SECRET
/**
 * werk.nl scraper - Fase 1 lijst-scan (manual trigger).
 *
 * POST /api/scrapers/werk-nl  body: { maxPages?: number, keywords?: string, location?: string }
 *
 * Bootstrapt een anonieme OAM-sessie, pagineert de publieke zoek-API op nieuwste,
 * en upsert elke vacature als minimale job_postings rij. Detail-verrijking, dedup
 * en delisting volgen in Fase 2/3. We zetten bewust GEEN needs_detail_scrape: die
 * vlag is eigendom van de career-page flow; de werk.nl detail-backlog komt in Fase
 * 2 als eigen werk_nl_scrape_queue.
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
import { upsertListing } from "@/lib/scrapers/werk_nl/upsert";
import { enqueue } from "@/lib/scrapers/werk_nl/queue";
import { JOB_SOURCE_NAME, PAGE_SIZE } from "@/lib/scrapers/werk_nl/constants";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

const DEFAULT_MAX_PAGES = 5;

async function postHandler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let body: { maxPages?: number; keywords?: string; location?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* lege body is toegestaan */
  }
  const maxPages = Math.max(1, Math.min(body.maxPages ?? DEFAULT_MAX_PAGES, 1000));
  const keywords = body.keywords ?? "";
  const location = body.location ?? "";

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);

  let newCount = 0;
  let seenCount = 0;
  let total = 0;
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
      for (const item of items) {
        const { jobPostingId, outcome } = await upsertListing(supabase, item, sourceId, nowIso);
        if (outcome === "new") {
          newCount++;
          newIds.push(jobPostingId);
        } else {
          seenCount++;
        }
      }
      // politeness tussen pagina's
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
    }

    // Nieuwe vacatures in de detail-queue zetten (worker verrijkt later).
    const enqueued = await enqueue(supabase, newIds, orchestrationId);

    await updateJobSourceStatus(supabase, sourceId, {
      success: true,
      count: newCount,
    });

    console.log(
      `[werknl] lijst-scan klaar: pages<=${maxPages} new=${newCount} seen=${seenCount} enqueued=${enqueued} total=${total}`
    );
    return NextResponse.json({
      success: true,
      stats: {
        pages_scanned: Math.min(maxPages, Math.ceil(total / PAGE_SIZE) || maxPages),
        new: newCount,
        seen: seenCount,
        enqueued,
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

export const POST = withCronAuth(postHandler);
