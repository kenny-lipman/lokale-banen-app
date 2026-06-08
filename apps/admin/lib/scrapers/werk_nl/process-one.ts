/**
 * Verrijk één werk.nl-vacature met detaildata.
 * detail -> map -> company-dedup -> job_postings update -> contact -> finalize(success).
 * 404 of verstreken expirationDate -> archiveer i.p.v. verrijken (geen detailcall verspild).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDetail } from "./detail-client";
import { mapDetail } from "./detail-mapper";
import { findOrCreateCompanyWerknl } from "./dedup";
import { findOrCreateContact } from "@/lib/scrapers/shared";
import { finalize } from "./queue";
import { JOB_SOURCE_NAME } from "./constants";
import type { WerknlSession } from "./session";

export type ProcessOutcome = "enriched" | "archived_gone" | "archived_expired" | "skipped_no_ref";

export function parseWerknlDateAsUtc(value: string): Date {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

async function archive(
  supabase: SupabaseClient,
  jobPostingId: string,
  reason: string,
  nowIso: string
): Promise<void> {
  const { error } = await supabase
    .from("job_postings")
    .update({ archived_at: nowIso, archived_reason: reason, status: "archived" })
    .eq("id", jobPostingId);
  if (error) throw new Error(`[werknl] archiveren faalde (${reason}): ${error.message}`);
}

export async function processOne(
  supabase: SupabaseClient,
  session: WerknlSession,
  jobPostingId: string,
  nowIso: string,
  sourceId: string
): Promise<ProcessOutcome> {
  // Bron-id (referenceNumber) ophalen.
  const { data: row } = await supabase
    .from("job_postings")
    .select("external_vacancy_id")
    .eq("id", jobPostingId)
    .maybeSingle();
  const externalId = (row as { external_vacancy_id?: string } | null)?.external_vacancy_id;
  if (!externalId) {
    await finalize(supabase, jobPostingId, { status: "validation_failed", error: "geen external_vacancy_id" });
    return "skipped_no_ref";
  }

  const result = await fetchDetail(session, Number(externalId));

  // Vacature bestaat niet meer -> archiveren.
  if (result.notFound) {
    await archive(supabase, jobPostingId, "not_in_werknl", nowIso);
    await finalize(supabase, jobPostingId, { status: "success", stats: { archived: "not_in_werknl" } });
    return "archived_gone";
  }

  const mapped = mapDetail(result.detail);
  const expiresAt = mapped.expiresAt ? parseWerknlDateAsUtc(mapped.expiresAt).toISOString() : null;

  // Verstreken vervaldatum -> archiveren.
  if (expiresAt && Date.parse(expiresAt) < Date.parse(nowIso)) {
    await archive(supabase, jobPostingId, "expired", nowIso);
    await finalize(supabase, jobPostingId, { status: "success", stats: { archived: "expired" } });
    return "archived_expired";
  }

  // Company-dedup.
  let companyId: string | null = null;
  if (mapped.company) {
    const dedup = await findOrCreateCompanyWerknl(supabase, mapped.company, sourceId);
    companyId = dedup.id;
  }

  // job_postings verrijken.
  const { error: updErr } = await supabase
    .from("job_postings")
    .update({
      ...mapped.jobPatch,
      company_id: companyId,
      expires_at: expiresAt,
      detail_scraped_at: nowIso,
    })
    .eq("id", jobPostingId);
  if (updErr) throw new Error(`[werknl] job_postings verrijken faalde: ${updErr.message}`);

  // Contact aanmaken/linken.
  if (mapped.contact && companyId) {
    await findOrCreateContact(
      supabase,
      companyId,
      { name: mapped.contact.name, email: mapped.contact.email, phone: mapped.contact.phone },
      JOB_SOURCE_NAME
    );
  }

  await finalize(supabase, jobPostingId, { status: "success" });
  return "enriched";
}
