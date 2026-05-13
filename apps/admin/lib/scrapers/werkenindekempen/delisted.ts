/**
 * Delisted-detection voor werkenindekempen.nl scraper.
 *
 * Flow per run:
 *   1. Update last_seen_in_sitemap = now() voor alle URLs die NOG in sitemap staan
 *   2. Archive job_postings die > 3 dagen niet meer gezien zijn
 *      (3 runs grace om sitemap-glitches / korte caches op te vangen)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const DELIST_GRACE_DAYS = 3;

export interface DelistedResult {
  touched: number;
  archived: number;
}

export async function refreshSitemapPresence(
  supabase: SupabaseClient,
  sourceId: string,
  currentUrls: string[]
): Promise<DelistedResult> {
  const now = new Date().toISOString();
  let touched = 0;

  // Batch-update in chunks van 50.
  // Werkenindekempen URLs zijn ~100 chars; 50 × 100 = ~5KB IN-clause met URL-encoding,
  // veilig binnen de ~8KB PostgREST URL-limiet.
  const CHUNK = 50;
  for (let i = 0; i < currentUrls.length; i += CHUNK) {
    const chunk = currentUrls.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("job_postings")
      .update({ last_seen_in_sitemap: now }, { count: "exact" })
      .eq("source_id", sourceId)
      .in("url", chunk);
    if (error) throw new Error(`Update last_seen_in_sitemap failed: ${error.message}`);
    touched += count ?? 0;
  }

  // Archive: source=wik AND niet gearchiveerd AND last_seen < now - 3 dagen
  const graceCutoff = new Date(
    Date.now() - DELIST_GRACE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error: archError, count } = await supabase
    .from("job_postings")
    .update(
      { archived_at: now, archived_reason: "not_in_sitemap" },
      { count: "exact" }
    )
    .eq("source_id", sourceId)
    .is("archived_at", null)
    .lt("last_seen_in_sitemap", graceCutoff);
  if (archError) throw new Error(`Archive delisted failed: ${archError.message}`);

  return { touched, archived: count ?? 0 };
}
