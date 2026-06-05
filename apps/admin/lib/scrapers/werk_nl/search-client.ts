/**
 * Search-client: haalt één zoekpagina op via de publieke werk.nl zoek-API.
 * Per item los gevalideerd zodat één kapot item de hele pagina niet sloopt.
 */

import { werknlFetch, type WerknlSession } from "./session";
import { SearchItemSchema, buildSearchBody, type SearchItem } from "./types";
import { SEARCH_URL } from "./constants";

export interface SearchPageResult {
  items: SearchItem[];
  total: number;
}

export async function searchPage(
  session: WerknlSession,
  page: number,
  keywords = "",
  location = ""
): Promise<SearchPageResult> {
  const res = await werknlFetch(session, SEARCH_URL, {
    method: "POST",
    body: buildSearchBody(page, keywords, location),
  });
  if (!res.ok) throw new Error(`[werknl] zoek-API HTTP ${res.status} (pagina ${page})`);

  const raw = JSON.parse(await res.text()) as { items?: unknown[]; totalResults?: number };
  const items: SearchItem[] = [];
  for (const it of raw.items ?? []) {
    const parsed = SearchItemSchema.safeParse(it);
    if (parsed.success) items.push(parsed.data);
  }
  return { items, total: raw.totalResults ?? 0 };
}
