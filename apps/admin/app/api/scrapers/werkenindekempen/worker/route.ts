// @auth SECRET
/**
 * Werkenindekempen worker — processed 1 batch URLs uit de queue.
 *
 * POST body: { orchestrationId: string, batchSize?: number }
 * - Claimed batchSize (default 5) pending URLs voor de orchestration
 * - Processed sequentieel (met humanDelay tussen URLs)
 * - Finalized elke queue-rij naar success / error / validation_failed
 * - Re-triggert zichzelf als er nog pending werk is én er ≥ 30s tijd over is
 *
 * Runtime budget: maxDuration=120s. Per URL ~10s × 5 = 50s + 10s buffer.
 * Auth: CRON_SECRET via withCronAuth.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/auth-middleware";
import { createSupabaseClient, getOrCreateJobSource } from "@/lib/scrapers/shared";
import {
  humanDelay,
  newSession,
  RateLimitError,
} from "@/lib/scrapers/werkenindekempen/fetch-polite";
import { processOne } from "@/lib/scrapers/werkenindekempen/process-one";
import { JobPostingValidationError } from "@/lib/scrapers/werkenindekempen/detail-parser";
import { claimBatch, countRemaining, finalizeQueueItem } from "@/lib/scrapers/werkenindekempen/queue";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 120;

const JOB_SOURCE_NAME = "Werken in de Kempen";
const DEFAULT_BATCH_SIZE = 5;
const DELAY_MIN_MS = 2_000;
const DELAY_MAX_MS = 3_000;
const READ_BURST_CHANCE = 0.15;
const REQUEUE_THRESHOLD_MS = 30_000; // re-trigger als > 30s over

async function workerHandler(req: NextRequest) {
  const started = Date.now();
  const body = await req.json().catch(() => ({}));
  const orchestrationId = String(body.orchestrationId ?? "");
  const batchSize = Number(body.batchSize ?? DEFAULT_BATCH_SIZE);

  if (!orchestrationId) {
    return NextResponse.json({ success: false, error: "orchestrationId required" }, { status: 400 });
  }

  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);
  const session = newSession();

  const claimed = await claimBatch(supabase, orchestrationId, batchSize);
  if (claimed.length === 0) {
    return NextResponse.json({ success: true, orchestrationId, processed: 0, message: "Nothing to claim" });
  }

  console.log(`[wik-worker] orch=${orchestrationId} claimed=${claimed.length}`);

  let processed = 0;
  let rateLimited = false;

  for (const item of claimed) {
    try {
      await humanDelay(DELAY_MIN_MS, DELAY_MAX_MS, READ_BURST_CHANCE);
      const result = await processOne(supabase, session, sourceId, item.url, {
        skipAI: false,
        dryRun: false,
      });
      await finalizeQueueItem(supabase, item.url, "success", result);
      processed++;
    } catch (err) {
      if (err instanceof RateLimitError) {
        await finalizeQueueItem(supabase, item.url, "error", { errorMessage: err.message });
        rateLimited = true;
        console.warn(`[wik-worker] rate-limited on ${item.url} — stopping`);
        break;
      }
      if (err instanceof JobPostingValidationError) {
        await finalizeQueueItem(supabase, item.url, "validation_failed", {
          errorMessage: err.message.slice(0, 500),
        });
        processed++;
        continue;
      }
      const msg = err instanceof Error ? err.message : "Unknown error";
      await finalizeQueueItem(supabase, item.url, "error", { errorMessage: msg.slice(0, 500) });
      console.error(`[wik-worker] error on ${item.url}:`, msg);
    }
  }

  // Re-trigger zichzelf als er nog werk is én tijd over
  const elapsed = Date.now() - started;
  const remaining = await countRemaining(supabase, orchestrationId);
  let rechained = false;
  if (!rateLimited && remaining > 0 && elapsed < (maxDuration * 1000 - REQUEUE_THRESHOLD_MS)) {
    rechained = await rechainWorker(orchestrationId, batchSize);
  }

  return NextResponse.json({
    success: true,
    orchestrationId,
    processed,
    remaining,
    rateLimited,
    rechained,
    elapsed_ms: elapsed,
  });
}

async function rechainWorker(orchestrationId: string, batchSize: number): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY;
  if (!cronSecret) {
    console.warn("[wik-worker] no CRON_SECRET — cannot rechain");
    return false;
  }
  try {
    // Fire-and-forget; gebruik AbortController met tiny timeout zodat fetch direct teruggeeft
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    void fetch(`${baseUrl}/api/scrapers/werkenindekempen/worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ orchestrationId, batchSize }),
      signal: ctrl.signal,
    }).catch(() => {
      /* expected abort */
    });
    return true;
  } catch (err) {
    console.warn(`[wik-worker] rechain failed:`, err);
    return false;
  }
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export const POST = withCronAuth(workerHandler);
