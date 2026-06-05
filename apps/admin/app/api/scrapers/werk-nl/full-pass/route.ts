// @auth SECRET
/**
 * werk.nl volledige-pass orchestrator (Fase 3, ADR 0002).
 *
 * GET/POST /api/scrapers/werk-nl/full-pass
 *
 * Loopt cursor-gestuurd over ALLE vacatures, verspreid over meerdere cron-runs.
 * Elke geziene vacature krijgt een verse `last_seen_in_sitemap`; nieuwe worden
 * geinsert + enqueued. Bij het bereiken van het einde (lege pagina) is de pass
 * VOLTOOID: de delisting-sweep archiveert alles dat sinds pass-start niet gezien is.
 * Een nieuwe pass start automatisch als de vorige > STALE_DAYS geleden voltooide.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/auth-middleware";
import { createSupabaseClient, getOrCreateJobSource, updateJobSourceStatus } from "@/lib/scrapers/shared";
import { bootstrapSession } from "@/lib/scrapers/werk_nl/session";
import { searchPage } from "@/lib/scrapers/werk_nl/search-client";
import { upsertListing } from "@/lib/scrapers/werk_nl/upsert";
import { enqueue } from "@/lib/scrapers/werk_nl/queue";
import { archiveNotSeenSince } from "@/lib/scrapers/werk_nl/delisted";
import { getScanState, isPassDue, startPass, saveCursor, completePass } from "@/lib/scrapers/werk_nl/scan-state";
import { JOB_SOURCE_NAME } from "@/lib/scrapers/werk_nl/constants";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

const STALE_DAYS = 7; // nieuwe pass als vorige > 7 dagen geleden voltooide
const MAX_PAGES_PER_RUN = 200; // tijdbudget begrenst meestal eerder
const TIME_BUDGET_MS = 270_000;

async function handler(_req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);
  const nowIso = new Date().toISOString();

  const state = await getScanState(supabase);

  // Pass bepalen: doorgaan met actieve pass, of een nieuwe starten als due.
  let cursor: number;
  let passStartedAt: string;
  if (state.pass_cursor === 0) {
    if (!isPassDue(state, Date.now(), STALE_DAYS)) {
      return NextResponse.json({
        success: true,
        skipped: "pass niet due",
        last_completed_at: state.pass_completed_at,
      });
    }
    await startPass(supabase, nowIso);
    cursor = 1;
    passStartedAt = nowIso;
  } else {
    cursor = state.pass_cursor;
    passStartedAt = state.pass_started_at ?? nowIso;
  }

  const newIds: string[] = [];
  let refreshed = 0;
  let pagesThisRun = 0;
  let total = 0;
  let passComplete = false;

  try {
    const session = await bootstrapSession();
    const orchestrationId = `werknl-fullpass-${passStartedAt}`;

    while (pagesThisRun < MAX_PAGES_PER_RUN && Date.now() - startTime < TIME_BUDGET_MS) {
      const { items, total: t } = await searchPage(session, cursor);
      total = t;
      if (items.length === 0) {
        passComplete = true;
        break;
      }
      for (const item of items) {
        const { jobPostingId, outcome } = await upsertListing(supabase, item, sourceId, nowIso);
        if (outcome === "new") newIds.push(jobPostingId);
        else refreshed++;
      }
      cursor++;
      pagesThisRun++;
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));
    }

    if (newIds.length > 0) await enqueue(supabase, newIds, orchestrationId);

    let archived = 0;
    if (passComplete) {
      await completePass(supabase, nowIso);
      archived = await archiveNotSeenSince(supabase, sourceId, passStartedAt, nowIso);
    } else {
      await saveCursor(supabase, cursor);
    }

    await updateJobSourceStatus(supabase, sourceId, { success: true, count: newIds.length });

    console.log(
      `[werknl] full-pass run: pages=${pagesThisRun} cursor=${passComplete ? 0 : cursor} new=${newIds.length} refreshed=${refreshed} complete=${passComplete} archived=${archived}`
    );
    return NextResponse.json({
      success: true,
      stats: {
        pages_this_run: pagesThisRun,
        cursor_at: passComplete ? 0 : cursor,
        new: newIds.length,
        refreshed,
        pass_complete: passComplete,
        archived,
        total_available: total,
      },
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    // Cursor bewaren wat we wel deden, zodat de volgende run verder gaat.
    await saveCursor(supabase, cursor).catch(() => {});
    await updateJobSourceStatus(supabase, sourceId, { success: false, earlyExitReason: "fatal", count: newIds.length });
    console.error("[werknl] full-pass fataal:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error", duration_ms: Date.now() - startTime },
      { status: 500 }
    );
  }
}

export const POST = withCronAuth(handler);
export const GET = POST;
