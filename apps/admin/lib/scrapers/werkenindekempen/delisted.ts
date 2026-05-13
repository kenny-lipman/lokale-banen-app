/**
 * Delisted-detection voor werkenindekempen.nl scraper.
 *
 * Twee-fasenstrategie om false-positive archives bij flaky runs te voorkomen:
 *
 *   FASE 1: refreshLastSeen(supabase, sourceId, currentUrls)
 *     - Update last_seen_in_sitemap = now() voor alle URLs uit sitemap
 *     - Wordt ALTIJD aangeroepen (ook bij early-exit rate-limit/timeout)
 *     - Voorkomt dat een gemiste run het last_seen-veld stale laat staan
 *
 *   FASE 2: archiveDelisted(supabase, sourceId)
 *     - Markeer job_postings die > GRACE_DAYS niet gezien zijn als archived
 *     - Wordt ALLEEN aangeroepen bij volledig succesvolle run
 *     - 4-dagen grace = 4 runs ruimte voor één gemiste daily cron + 3 buffer
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const DELIST_GRACE_DAYS = 4;
const CHUNK = 50;

export interface RefreshResult {
  touched: number;
}

export interface ArchiveResult {
  archived: number;
}

/**
 * Update `last_seen_in_sitemap = now()` voor alle DB-rows van deze source
 * waarvan de URL nog in de sitemap voorkomt.
 *
 * Idempotent en non-destructief — veilig om altijd aan te roepen.
 *
 * Chunks van 50 om binnen ~8KB PostgREST URL-limiet te blijven
 * (werkenindekempen URLs zijn ~100 chars).
 */
export async function refreshLastSeen(
  supabase: SupabaseClient,
  sourceId: string,
  currentUrls: string[]
): Promise<RefreshResult> {
  const now = new Date().toISOString();
  let touched = 0;

  for (let i = 0; i < currentUrls.length; i += CHUNK) {
    const chunk = currentUrls.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("job_postings")
      .update({ last_seen_in_sitemap: now }, { count: "exact" })
      .eq("source_id", sourceId)
      .in("url", chunk);
    if (error) throw new Error(`refreshLastSeen failed: ${error.message}`);
    touched += count ?? 0;
  }

  return { touched };
}

/**
 * Archive job_postings die > DELIST_GRACE_DAYS niet meer in de sitemap stonden.
 *
 * Roep ALLEEN aan bij volledig succesvolle run (geen early-exit).
 * Anders kan een vacature die nog leeft per ongeluk als delisted aangemerkt worden.
 */
export async function archiveDelisted(
  supabase: SupabaseClient,
  sourceId: string
): Promise<ArchiveResult> {
  const now = new Date().toISOString();
  const graceCutoff = new Date(
    Date.now() - DELIST_GRACE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error, count } = await supabase
    .from("job_postings")
    .update(
      { archived_at: now, archived_reason: "not_in_sitemap" },
      { count: "exact" }
    )
    .eq("source_id", sourceId)
    .is("archived_at", null)
    .lt("last_seen_in_sitemap", graceCutoff);
  if (error) throw new Error(`archiveDelisted failed: ${error.message}`);

  return { archived: count ?? 0 };
}
