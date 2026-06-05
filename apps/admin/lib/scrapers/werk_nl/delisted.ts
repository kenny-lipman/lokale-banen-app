/**
 * Delisting-sweep voor werk.nl (Fase 3, ADR 0002).
 *
 * Wordt alleen gedraaid na een VOLTOOIDE volledige pass. Archiveert elke nog-actieve
 * werk.nl-vacature die sinds de pass-start niet meer ververst is (dus niet meer in de
 * bron voorkwam). De incrementele scan archiveert nooit; dit is het autoritatieve moment.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function archiveNotSeenSince(
  supabase: SupabaseClient,
  sourceId: string,
  passStartedAtIso: string,
  nowIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from("job_postings")
    .update(
      { archived_at: nowIso, archived_reason: "not_in_werknl", status: "archived" },
      { count: "exact" }
    )
    .eq("source_id", sourceId)
    .lt("last_seen_in_sitemap", passStartedAtIso)
    .is("archived_at", null);
  if (error) throw new Error(`[werknl] delisting-sweep faalde: ${error.message}`);
  return count ?? 0;
}
