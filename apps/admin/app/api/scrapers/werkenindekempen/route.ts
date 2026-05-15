/**
 * API Route voor werkenindekempen.nl scraper — orchestrator-mode (Fase 2).
 *
 * Cron triggert sitemap-diff + enqueue + fire workers → workers processen batches →
 * finalizer (separate cron, every 5 min) schrijft de definitieve automation_runs rij
 * per voltooide orchestration met geaggregeerde scrape-stats.
 *
 * Deze route is bewust NIET gewrapped met withCronMonitoring: de orchestrator-trigger
 * is geen scrape-run in zichzelf, dus geen rij in automation_runs vanuit hier.
 * De finalizer is verantwoordelijk voor de scraper-run row.
 *
 * GET  /api/scrapers/werkenindekempen   — Vercel Cron trigger
 * POST /api/scrapers/werkenindekempen   — Manual trigger (zelfde flow)
 *
 * Runtime: nodejs. Region fra1/ams1.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronAuth } from "@/lib/auth-middleware";
import { createSupabaseClient, getOrCreateJobSource } from "@/lib/scrapers/shared";
import { fetchPolite, newSession } from "@/lib/scrapers/werkenindekempen/fetch-polite";
import { parseSitemap, diffFresh, SITEMAP_URL } from "@/lib/scrapers/werkenindekempen/sitemap-parser";
import { enqueueUrls } from "@/lib/scrapers/werkenindekempen/queue";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 60;

const JOB_SOURCE_NAME = "Werken in de Kempen";
const ORCH_MAX_URLS = 100;            // max queue-grootte per orchestration (genoeg voor catch-up)
const ORCH_WORKER_BATCH_SIZE = 5;     // URLs per worker-call
const ORCH_MAX_PARALLEL_WORKERS = 4;  // initiële parallel workers (5 × 4 = 20 URLs concurrent in ~50s)

/** Random jitter 0-60s zodat we niet exact op :00 vuren. Kort houden: maxDuration is 60s. */
const MAX_JITTER_MS = 60 * 1000;

async function runOrchestrator(applyJitter: boolean): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    if (applyJitter) {
      const jitterMs = Math.random() * MAX_JITTER_MS * 0.5; // half van budget
      await new Promise((r) => setTimeout(r, jitterMs));
    }

    const supabase = createSupabaseClient();
    const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);
    const session = newSession();

    // 1. Sitemap fetch + parse
    const sitemapRes = await fetchPolite(SITEMAP_URL, session, { isFirstRequest: true });
    if (!sitemapRes.html) {
      return NextResponse.json(
        { success: false, error: "Empty sitemap response", mode: "orchestrator" },
        { status: 500 }
      );
    }
    const allEntries = parseSitemap(sitemapRes.html);
    const sitemapTotal = allEntries.length;

    // 2. Last-seen diff
    const lastSeenMap = await loadLastSeenMap(supabase, sourceId);
    const fresh = diffFresh(allEntries, lastSeenMap).slice(0, ORCH_MAX_URLS);

    // 3. Enqueue
    const orchestrationId = makeOrchestrationId();
    const enqueued = await enqueueUrls(supabase, orchestrationId, fresh.map((e) => e.url));

    if (enqueued === 0) {
      console.log(`[wik-orch] sitemap_total=${sitemapTotal} fresh=0 — nothing to do`);
      return NextResponse.json({
        success: true,
        mode: "orchestrator",
        message: "No fresh URLs",
        stats: {
          sitemap_total: sitemapTotal,
          fresh: 0,
          urls_queued: 0,
          workers_triggered: 0,
          orchestration_id: orchestrationId,
        },
        duration_ms: Date.now() - startTime,
      });
    }

    // 4. Fire workers (parallel, fire-and-forget met short fetch-timeout)
    const workerCount = Math.min(
      ORCH_MAX_PARALLEL_WORKERS,
      Math.ceil(enqueued / ORCH_WORKER_BATCH_SIZE)
    );
    const workersTriggered = await fireWorkers(orchestrationId, workerCount);

    console.log(
      `[wik-orch] orch=${orchestrationId} sitemap_total=${sitemapTotal} fresh=${enqueued} workers_triggered=${workersTriggered}`
    );

    return NextResponse.json({
      success: true,
      mode: "orchestrator",
      message: "Orchestration started",
      stats: {
        sitemap_total: sitemapTotal,
        fresh: enqueued,
        urls_queued: enqueued,
        workers_triggered: workersTriggered,
        orchestration_id: orchestrationId,
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[wik-orch] Fatal:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        mode: "orchestrator",
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

async function getHandler(_req: NextRequest) {
  return runOrchestrator(/*applyJitter*/ true);
}

async function postHandler(_req: NextRequest) {
  return runOrchestrator(/*applyJitter*/ false);
}

async function loadLastSeenMap(
  supabase: ReturnType<typeof createSupabaseClient>,
  sourceId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("job_postings")
      .select("url, last_seen_in_sitemap")
      .eq("source_id", sourceId)
      .not("url", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`loadLastSeenMap: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data as Array<{ url: string; last_seen_in_sitemap: string | null }>) {
      map.set(row.url, row.last_seen_in_sitemap ?? "");
    }
    if (data.length < pageSize) break;
    page++;
  }
  return map;
}

function makeOrchestrationId(): string {
  const ts = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replaceAll("T", "")
    .slice(0, 14);
  return `wik_${ts}_${Math.random().toString(36).slice(2, 8)}`;
}

async function fireWorkers(orchestrationId: string, count: number): Promise<number> {
  const baseUrl = getBaseUrl();
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY;
  if (!cronSecret) {
    console.warn("[wik-orch] no CRON_SECRET — cannot fire workers");
    return 0;
  }
  const url = `${baseUrl}/api/scrapers/werkenindekempen/worker`;
  let fired = 0;
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 2000); // fire-and-forget
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ orchestrationId, batchSize: ORCH_WORKER_BATCH_SIZE }),
          signal: ctrl.signal,
        }).catch(() => {
          /* expected abort */
        });
        fired++;
      } catch (err) {
        console.warn(`[wik-orch] worker ${i} fire failed:`, err);
      }
    })
  );
  return fired;
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

export const GET = withCronAuth(getHandler);
export const POST = withCronAuth(postHandler);
