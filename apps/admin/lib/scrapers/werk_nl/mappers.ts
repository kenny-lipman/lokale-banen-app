/**
 * Mapt een werk.nl SearchItem naar een minimale job_postings insert-rij.
 * company_id blijft null (dedup gebeurt in Fase 2 via de detail-API).
 *
 * BELANGRIJK: we zetten hier bewust GEEN `needs_detail_scrape`. Die boolean is
 * eigendom van de career-page-detail-scrape flow (een bron-blinde cron die elke
 * rij met die vlag oppakt en de generieke career-page-extractor erop draait).
 * werk.nl is een eigen bounded context: de detail-backlog komt in Fase 2 als
 * aparte `werk_nl_scrape_queue`, niet via deze gedeelde vlag.
 */

import type { SearchItem } from "./types";
import { DETAIL_URL_BASE } from "./constants";

export interface JobPostingRow {
  title: string;
  external_vacancy_id: string;
  source_id: string;
  company_id: null;
  url: string;
  city: string | null;
  location: string | null;
  employment: string | null;
  working_hours_min: number | null;
  working_hours_max: number | null;
  status: string;
  review_status: string;
  last_seen_in_sitemap: string;
  scraped_at: string;
}

/** Title-case een UWV-stad ("TERNEUZEN" -> "Terneuzen", "MAASTRICHT-AIRPORT" -> "Maastricht-Airport"). */
export function titleCaseCity(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function mapSearchItem(item: SearchItem, sourceId: string, nowIso: string): JobPostingRow {
  const title = (item.vacatureTitle || item.profession || "").trim() || "Onbekende vacature";
  const city = titleCaseCity(item.workLocationCity);
  return {
    title,
    external_vacancy_id: String(item.referenceNumber),
    source_id: sourceId,
    company_id: null,
    url: `${DETAIL_URL_BASE}/${item.referenceNumber}`,
    city,
    // location = city: nodig zodat de geocoding-worker (filtert op location is not null)
    // werk.nl-vacatures oppakt en aan een regio/platform koppelt. Mirror van werkenindekempen.
    location: city,
    employment: item.contractType?.trim() || null,
    working_hours_min: item.minHours ?? null,
    working_hours_max: item.maxHours ?? null,
    status: "new",
    review_status: "pending",
    last_seen_in_sitemap: nowIso,
    scraped_at: nowIso,
  };
}
