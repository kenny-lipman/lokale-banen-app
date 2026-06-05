/**
 * Queue-lib voor de werk.nl detail-verrijking (Fase 2).
 * enqueue (vanuit lijst-scan) -> claimBatch (worker, via RPC) -> finalize.
 * Eigen queue, niet de gedeelde needs_detail_scrape-vlag (ADR 0001).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type FinalizeStatus = "success" | "error" | "validation_failed";

/** Enqueue job_posting_ids als pending. Bestaande rijen blijven ongemoeid (PK = job_posting_id). */
export async function enqueue(
  supabase: SupabaseClient,
  jobPostingIds: string[],
  orchestrationId: string
): Promise<number> {
  if (jobPostingIds.length === 0) return 0;
  const rows = jobPostingIds.map((id) => ({
    job_posting_id: id,
    orchestration_id: orchestrationId,
    status: "pending",
  }));
  const { error } = await supabase
    .from("werk_nl_scrape_queue")
    .upsert(rows, { onConflict: "job_posting_id", ignoreDuplicates: true });
  if (error) throw new Error(`[werknl] enqueue faalde: ${error.message}`);
  return rows.length;
}

export interface ClaimedItem {
  jobPostingId: string;
  attempts: number;
}

/** Atomic claim van N pending rijen via de werknl_claim_batch RPC (FOR UPDATE SKIP LOCKED). */
export async function claimBatch(
  supabase: SupabaseClient,
  orchestrationId: string,
  batchSize: number
): Promise<ClaimedItem[]> {
  const { data, error } = await supabase.rpc("werknl_claim_batch", {
    p_orchestration_id: orchestrationId,
    p_batch_size: batchSize,
  });
  if (error) throw new Error(`[werknl] claimBatch faalde: ${error.message}`);
  return (data ?? []).map((row: { job_posting_id: string; attempts: number }) => ({
    jobPostingId: row.job_posting_id,
    attempts: row.attempts,
  }));
}

/** Sluit een queue-rij af. */
export async function finalize(
  supabase: SupabaseClient,
  jobPostingId: string,
  outcome: { status: FinalizeStatus; error?: string; stats?: Record<string, unknown> }
): Promise<void> {
  const { error } = await supabase
    .from("werk_nl_scrape_queue")
    .update({
      status: outcome.status,
      completed_at: new Date().toISOString(),
      error_message: outcome.error ?? null,
      result_stats: outcome.stats ?? null,
    })
    .eq("job_posting_id", jobPostingId);
  if (error) throw new Error(`[werknl] finalize faalde: ${error.message}`);
}
