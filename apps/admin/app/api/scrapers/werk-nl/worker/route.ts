// @auth SECRET
/**
 * werk.nl detail-verrijking worker (Fase 2).
 *
 * POST /api/scrapers/werk-nl/worker  body: { orchestrationId: string, batchSize?, maxBatches? }
 *
 * Claimt batches uit werk_nl_scrape_queue (atomic via werknl_claim_batch RPC) en
 * verrijkt elke vacature via de detail-API (2-5s delay). 404/verlopen -> archiveren.
 * Loopt door binnen het tijdbudget; resterend werk volgt in de volgende run.
 * Cron-registratie volgt in Fase 3.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/auth-middleware";
import { createSupabaseClient, getOrCreateJobSource, updateJobSourceStatus } from "@/lib/scrapers/shared";
import { bootstrapSession } from "@/lib/scrapers/werk_nl/session";
import { claimBatch, reapStaleProcessing } from "@/lib/scrapers/werk_nl/queue";
import { processOne, type ProcessOutcome } from "@/lib/scrapers/werk_nl/process-one";
import { JOB_SOURCE_NAME } from "@/lib/scrapers/werk_nl/constants";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 300;

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_BATCHES = 50;
const TIME_BUDGET_MS = 270_000; // marge t.o.v. maxDuration
const STALE_PROCESSING_MS = 600_000; // 10 min: reset vastgelopen processing-rijen

async function handler(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let body: { orchestrationId?: string; batchSize?: number; maxBatches?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* lege body toegestaan (cron-GET) */
  }
  // Zonder orchestrationId (cron) draaien we in drain-modus: claim alles wat pending is.
  const orchestrationId = body.orchestrationId ?? null;
  const batchSize = Math.max(1, Math.min(body.batchSize ?? DEFAULT_BATCH_SIZE, 100));
  const maxBatches = Math.max(1, Math.min(body.maxBatches ?? DEFAULT_MAX_BATCHES, 1000));

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);

  const counts: Record<ProcessOutcome, number> = {
    enriched: 0,
    archived_gone: 0,
    archived_expired: 0,
    skipped_no_ref: 0,
  };
  let errorCount = 0;

  try {
    // Vastgelopen processing-rijen terugzetten naar pending (watchdog).
    const reaped = await reapStaleProcessing(supabase, STALE_PROCESSING_MS);
    if (reaped > 0) console.log(`[werknl] worker reaped ${reaped} vastgelopen processing-rijen`);

    const session = await bootstrapSession();

    for (let batch = 0; batch < maxBatches; batch++) {
      if (Date.now() - startTime > TIME_BUDGET_MS) break;
      const claimed = await claimBatch(supabase, orchestrationId, batchSize);
      if (claimed.length === 0) break;

      for (const { jobPostingId } of claimed) {
        if (Date.now() - startTime > TIME_BUDGET_MS) break;
        try {
          const outcome = await processOne(supabase, session, jobPostingId, new Date().toISOString(), sourceId);
          counts[outcome]++;
        } catch (err) {
          errorCount++;
          console.error(`[werknl] worker processOne faalde (${jobPostingId}):`, err);
        }
        // politeness tussen detailcalls
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
      }
    }

    await updateJobSourceStatus(supabase, sourceId, { success: true, count: counts.enriched });

    console.log(
      `[werknl] worker klaar: enriched=${counts.enriched} gone=${counts.archived_gone} expired=${counts.archived_expired} errors=${errorCount}`
    );
    return NextResponse.json({
      success: true,
      stats: { ...counts, errors: errorCount },
      duration_ms: Date.now() - startTime,
    });
  } catch (err) {
    await updateJobSourceStatus(supabase, sourceId, {
      success: false,
      earlyExitReason: "fatal",
      count: counts.enriched,
    });
    console.error("[werknl] worker fataal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        stats: { ...counts, errors: errorCount },
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export const POST = withCronAuth(handler);
export const GET = POST;
