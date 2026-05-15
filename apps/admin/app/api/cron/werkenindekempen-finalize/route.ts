/**
 * Werkenindekempen finalizer — runs every 5 min.
 *
 * Flow per cyclus:
 *   1. reap stale 'processing' rijen (> STALE_PROCESSING_MS) → reset naar 'pending'
 *   2. summarize orchestrations
 *   3. fetch sitemap 1× (gedeeld door alle finalizeable orchestrations dit cyclus)
 *   4. per orchestration met total > 0 én pending+processing == 0:
 *      - aggregeer per-URL stats
 *      - refresh last_seen_in_sitemap (gebruik sitemap-entries uit stap 3)
 *      - archive delisted (3-dagen grace)
 *      - INSERT automation_runs rij (automation_id='werkenindekempen-scraper')
 *      - update_job_sources_status
 *      - purge orchestration uit queue
 *
 * Auth: CRON_SECRET via withCronMonitoring.
 */

import { NextRequest, NextResponse } from "next/server";
import { withCronMonitoring } from "@/lib/cron-monitor";
import {
  createSupabaseClient,
  getOrCreateJobSource,
  updateJobSourceStatus,
} from "@/lib/scrapers/shared";
import { fetchPolite, newSession } from "@/lib/scrapers/werkenindekempen/fetch-polite";
import { parseSitemap, SITEMAP_URL } from "@/lib/scrapers/werkenindekempen/sitemap-parser";
import { refreshLastSeen, archiveDelisted } from "@/lib/scrapers/werkenindekempen/delisted";
import {
  aggregateOrchestrationStats,
  purgeOrchestration,
  reapStaleProcessing,
  summarizeOrchestrations,
} from "@/lib/scrapers/werkenindekempen/queue";

export const runtime = "nodejs";
export const preferredRegion = ["fra1", "ams1"];
export const maxDuration = 120;

const JOB_SOURCE_NAME = "Werken in de Kempen";
/** Rijen die langer dan 15 min in 'processing' zitten zijn (vrijwel zeker) verloren door
 *  een gecrashte worker. Worker self-rechain heeft ~12 min nodig om 5 URLs te verwerken in
 *  het allerslechtste geval; 15 min geeft veiligheidsmarge. */
const STALE_PROCESSING_MS = 15 * 60_000;

async function finalizeHandler(_req: NextRequest) {
  const startTime = Date.now();
  const supabase = createSupabaseClient();
  const sourceId = await getOrCreateJobSource(supabase, JOB_SOURCE_NAME);

  // 1. Reap stale 'processing' rijen (gecrashte workers)
  let reaped = 0;
  try {
    reaped = await reapStaleProcessing(supabase, STALE_PROCESSING_MS);
    if (reaped > 0) console.log(`[wik-finalize] Reaped ${reaped} stale processing rows`);
  } catch (err) {
    console.warn(`[wik-finalize] reapStaleProcessing failed:`, err);
  }

  // 2. Summarize en filter finalizeable orchestrations
  const summaries = await summarizeOrchestrations(supabase);
  // Filter: alleen orchestrations met total > 0 én alle workers klaar.
  // total=0 voorkomt ghost-runs (orchestration met 0 enqueued URLs zou anders gefinaliseerd worden).
  const done = summaries.filter(
    (s) => s.total > 0 && s.pending === 0 && s.processing === 0
  );

  if (done.length === 0) {
    return NextResponse.json({
      success: true,
      stats: {
        orchestrations_finalized: 0,
        orchestrations_pending: summaries.length,
        stale_processing_reaped: reaped,
      },
      duration_ms: Date.now() - startTime,
    });
  }

  // 3. Sitemap fetch 1× voor alle finalizeable orchestrations samen
  let sitemapEntries: { url: string }[] = [];
  let sitemapTotal = 0;
  try {
    const session = newSession();
    const sm = await fetchPolite(SITEMAP_URL, session, { isFirstRequest: true });
    if (sm.html) {
      sitemapEntries = parseSitemap(sm.html);
      sitemapTotal = sitemapEntries.length;
      await refreshLastSeen(supabase, sourceId, sitemapEntries.map((e) => e.url));
    }
  } catch (err) {
    console.warn(`[wik-finalize] sitemap refresh failed:`, err);
  }

  // Archive delisted 1× per cyclus (idempotent op last_seen_in_sitemap timestamps)
  let archivedTotal = 0;
  try {
    const r = await archiveDelisted(supabase, sourceId);
    archivedTotal = r.archived;
  } catch (err) {
    console.warn(`[wik-finalize] archiveDelisted failed:`, err);
  }

  // 4. Finalize elke orchestration
  let finalized = 0;
  let aggregateNew = 0;
  let aggregateUpdated = 0;
  let aggregateErrors = 0;

  for (const orch of done) {
    try {
      const stats = await aggregateOrchestrationStats(supabase, orch.orchestration_id);

      const { data: oldest } = await supabase
        .from("werkenindekempen_scrape_queue")
        .select("enqueued_at")
        .eq("orchestration_id", orch.orchestration_id)
        .order("enqueued_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const startedAt = oldest?.enqueued_at ?? new Date().toISOString();
      const now = new Date();

      const businessStats = {
        ...stats,
        sitemap_total: sitemapTotal,
        fresh: orch.total,
        // delisted wordt op aggregate-niveau gerapporteerd in deze cycle;
        // toewijzing aan één specifieke orchestration is willekeurig, dus we splitsen niet.
        delisted: 0,
        orchestration_id: orch.orchestration_id,
        workers_completed: orch.success + orch.error + orch.validation_failed,
        queue_remaining: 0,
      };

      const durationMs = Math.max(0, now.getTime() - new Date(startedAt).getTime());
      const { error: insErr } = await supabase.from("automation_runs").insert({
        automation_id: "werkenindekempen-scraper",
        started_at: startedAt,
        completed_at: now.toISOString(),
        duration_ms: durationMs,
        status:
          stats.errors > 0 && stats.new === 0 && stats.updated === 0 ? "error" : "success",
        business_stats: businessStats,
        triggered_by: "schedule",
        http_status: 200,
      });
      if (insErr) {
        console.error(`[wik-finalize] insert automation_runs failed:`, insErr.message);
        continue;
      }

      await updateJobSourceStatus(supabase, sourceId, {
        success: stats.errors === 0,
        count: stats.new + stats.updated,
      });

      await purgeOrchestration(supabase, orch.orchestration_id);

      finalized++;
      aggregateNew += stats.new;
      aggregateUpdated += stats.updated;
      aggregateErrors += stats.errors;
      console.log(
        `[wik-finalize] orch=${orch.orchestration_id} new=${stats.new} updated=${stats.updated} errors=${stats.errors}`
      );
    } catch (err) {
      console.error(`[wik-finalize] orch=${orch.orchestration_id} failed:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    stats: {
      orchestrations_finalized: finalized,
      orchestrations_pending: summaries.length - finalized,
      stale_processing_reaped: reaped,
      new: aggregateNew,
      updated: aggregateUpdated,
      errors: aggregateErrors,
      archived: archivedTotal,
      sitemap_total: sitemapTotal,
    },
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
}

const monitored = withCronMonitoring(
  "werkenindekempen-finalize",
  "/api/cron/werkenindekempen-finalize"
);
export const GET = monitored(finalizeHandler);
export const POST = monitored(finalizeHandler);
