/**
 * Queue-operaties voor werkenindekempen orchestrator/worker pattern.
 *
 * Orchestrator-flow:
 *   1. fetchSitemap → parseSitemap → diff vs last_seen_map
 *   2. enqueueOrchestration(): vul werkenindekempen_scrape_queue
 *
 * Worker-flow:
 *   1. claimBatch(): pick N pending URLs voor een orchestration_id, mark processing
 *   2. processOne()
 *   3. finalizeQueueItem(): mark success / error / validation_failed
 *
 * Finalizer-flow:
 *   1. listFinishedOrchestrations(): orchestrations zonder pending/processing rijen
 *   2. aggregeren → automation_runs.update + queue rows opruimen
 */

import type { SupabaseClient } from "@/lib/scrapers/shared";
import type { ProcessResult } from "./process-one";

export interface QueueClaim {
  url: string;
  attempts: number;
}

/**
 * Insert fresh URLs in queue. URLs die al in queue staan (pending/processing) worden geskipt.
 * Returns: aantal nieuw ingevoegd.
 */
export async function enqueueUrls(
  supabase: SupabaseClient,
  orchestrationId: string,
  urls: string[]
): Promise<number> {
  if (urls.length === 0) return 0;
  const rows = urls.map((url) => ({
    url,
    orchestration_id: orchestrationId,
    status: "pending" as const,
  }));
  // upsert met onConflict=url → bestaande rijen blijven onaangeroerd dankzij ignoreDuplicates.
  const { data, error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
    .select("url");
  if (error) throw new Error(`enqueueUrls: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * Claim batch van pending URLs voor één orchestration.
 * Uitsluitend via RPC `wik_claim_batch` (SELECT … FOR UPDATE SKIP LOCKED) — geen fallback
 * want non-locking SELECT+UPDATE heeft een race-window waarin twee workers dezelfde URL
 * kunnen claimen. Faalt de RPC, dan throwt deze functie en blijft de queue intact.
 */
export async function claimBatch(
  supabase: SupabaseClient,
  orchestrationId: string,
  batchSize: number
): Promise<QueueClaim[]> {
  const { data, error } = await supabase.rpc("wik_claim_batch", {
    p_orchestration_id: orchestrationId,
    p_batch_size: batchSize,
  });
  if (error) {
    throw new Error(`claimBatch RPC failed: ${error.message}`);
  }
  if (!data) return [];
  return (data as Array<{ url: string; attempts: number }>).map((r) => ({
    url: r.url,
    attempts: r.attempts,
  }));
}

/**
 * Reset 'processing' rijen die langer dan `staleAfterMs` ms in die status zitten terug naar 'pending'.
 * Voorkomt dat een gecrashte worker queue-rijen indefinite blokkeert.
 * Wordt aangeroepen door de finalizer-cron vóór de done-filter.
 */
export async function reapStaleProcessing(
  supabase: SupabaseClient,
  staleAfterMs: number
): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { data, error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .update({ status: "pending", picked_at: null })
    .eq("status", "processing")
    .lt("picked_at", cutoff)
    .select("url");
  if (error) throw new Error(`reapStaleProcessing: ${error.message}`);
  return data?.length ?? 0;
}

/** Mark queue-row klaar met outcome + per-URL result_stats. */
export async function finalizeQueueItem(
  supabase: SupabaseClient,
  url: string,
  outcome: "success" | "error" | "validation_failed",
  resultStats: Partial<ProcessResult> & { errorMessage?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .update({
      status: outcome,
      completed_at: now,
      error_message: resultStats.errorMessage ?? null,
      result_stats: resultStats,
      attempts: undefined, // increment via SQL update separately if we want retries
    })
    .eq("url", url);
  if (error) throw new Error(`finalizeQueueItem: ${error.message}`);
}

/** Aantal pending+processing rijen voor een orchestration. */
export async function countRemaining(
  supabase: SupabaseClient,
  orchestrationId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .select("url", { count: "exact", head: true })
    .eq("orchestration_id", orchestrationId)
    .in("status", ["pending", "processing"]);
  if (error) throw new Error(`countRemaining: ${error.message}`);
  return count ?? 0;
}

export interface OrchestrationSummary {
  orchestration_id: string;
  total: number;
  success: number;
  error: number;
  validation_failed: number;
  pending: number;
  processing: number;
}

/** Aggregeer alle queue-rijen per orchestration_id. */
export async function summarizeOrchestrations(
  supabase: SupabaseClient
): Promise<OrchestrationSummary[]> {
  const { data, error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .select("orchestration_id, status");
  if (error) throw new Error(`summarizeOrchestrations: ${error.message}`);

  const map = new Map<string, OrchestrationSummary>();
  for (const row of (data ?? []) as Array<{ orchestration_id: string; status: string }>) {
    let s = map.get(row.orchestration_id);
    if (!s) {
      s = {
        orchestration_id: row.orchestration_id,
        total: 0,
        success: 0,
        error: 0,
        validation_failed: 0,
        pending: 0,
        processing: 0,
      };
      map.set(row.orchestration_id, s);
    }
    s.total++;
    if (row.status === "success") s.success++;
    else if (row.status === "error") s.error++;
    else if (row.status === "validation_failed") s.validation_failed++;
    else if (row.status === "pending") s.pending++;
    else if (row.status === "processing") s.processing++;
  }
  return Array.from(map.values());
}

/** Aggregeer per-URL result_stats van één orchestration tot totalen. */
export async function aggregateOrchestrationStats(
  supabase: SupabaseClient,
  orchestrationId: string
): Promise<{
  new: number;
  updated: number;
  skipped: number;
  errors: number;
  validation_failures: number;
  companies_created: number;
  companies_matched: number;
  contacts_created: number;
  mistral_calls: number;
}> {
  const { data, error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .select("status, result_stats")
    .eq("orchestration_id", orchestrationId);
  if (error) throw new Error(`aggregateOrchestrationStats: ${error.message}`);

  const out = {
    new: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    validation_failures: 0,
    companies_created: 0,
    companies_matched: 0,
    contacts_created: 0,
    mistral_calls: 0,
  };
  for (const row of (data ?? []) as Array<{
    status: string;
    result_stats: Partial<ProcessResult> | null;
  }>) {
    const s = row.result_stats;
    if (row.status === "error") out.errors++;
    if (row.status === "validation_failed") out.validation_failures++;
    if (!s) continue;
    if (s.outcome === "new") out.new++;
    else if (s.outcome === "updated") out.updated++;
    else if (s.outcome === "skipped") out.skipped++;
    else if (s.outcome === "validation_failed") out.validation_failures++;
    if (s.mistralCalled) out.mistral_calls++;
    if (s.companyCreated) out.companies_created++;
    if (s.companyMatched) out.companies_matched++;
    if (s.contactCreated) out.contacts_created++;
  }
  return out;
}

/** Verwijder finished orchestration uit queue (na aggregatie). */
export async function purgeOrchestration(
  supabase: SupabaseClient,
  orchestrationId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("werkenindekempen_scrape_queue")
    .delete()
    .eq("orchestration_id", orchestrationId)
    .select("url");
  if (error) throw new Error(`purgeOrchestration: ${error.message}`);
  return data?.length ?? 0;
}
