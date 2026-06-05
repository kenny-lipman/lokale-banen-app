/**
 * Upsert van één lijst-vacature in job_postings.
 * - Nieuw (external_vacancy_id + source_id niet gevonden) -> insert minimale rij.
 * - Bestaand -> alleen last_seen verversen (delisting-signaal voor Fase 3).
 *
 * We raken `needs_detail_scrape` bewust niet aan: die vlag is eigendom van de
 * career-page-detail-scrape flow. De werk.nl detail-backlog wordt in Fase 2 via
 * een eigen `werk_nl_scrape_queue` bijgehouden.
 */

import type { SupabaseClient } from "@/lib/scrapers/shared";
import { mapSearchItem } from "./mappers";
import type { SearchItem } from "./types";

export type UpsertOutcome = "new" | "seen";

export async function upsertListing(
  supabase: SupabaseClient,
  item: SearchItem,
  sourceId: string,
  nowIso: string
): Promise<UpsertOutcome> {
  const externalId = String(item.referenceNumber);

  const { data: existing } = await supabase
    .from("job_postings")
    .select("id")
    .eq("external_vacancy_id", externalId)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("job_postings")
      .update({ last_seen_in_sitemap: nowIso })
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(`[werknl] update faalde: ${error.message}`);
    return "seen";
  }

  const row = mapSearchItem(item, sourceId, nowIso);
  const { error } = await supabase.from("job_postings").insert(row);
  if (error) throw new Error(`[werknl] insert faalde: ${error.message}`);
  return "new";
}
