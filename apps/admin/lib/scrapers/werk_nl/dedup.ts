/**
 * 3-laagse company-dedup voor de werk.nl scraper.
 *
 * Match-volgorde (eerste hit wint):
 *   1. companies.werknl_employer_id = employer.referenceNumber
 *   2. companies.normalized_name (cross-source: zelfde werkgever op andere bronnen)
 *   3. companies.hoofddomein (catch-all op website-domain)
 *   4. -> CREATE nieuwe row
 *
 * Bij match op laag 2/3 backfillen we werknl_employer_id (en zetten is_bemiddelaar
 * op true als de heuristiek dat zegt), zodat volgende runs direct laag 1 hit en de
 * cross-source company-graaf zich opbouwt. Backfill-conflict throwt niet, maar wordt
 * via DedupResult.conflict gemeld. Adaptatie van werkenindekempen/dedup.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNormalizedName } from "@/lib/scrapers/shared/utils";
import { extractHoofddomein } from "@/lib/scrapers/werkenindekempen/normalizers";
import type { WerknlCompanyInput } from "./detail-mapper";

export interface DedupResult {
  id: string;
  matchedLayer: "werknl_employer_id" | "normalized_name" | "hoofddomein" | "new";
  conflict?: string;
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === "23505" || /duplicate key value violates unique constraint/i.test(error?.message ?? "");
}

async function findByWerknlEmployerId(
  supabase: SupabaseClient,
  werknlEmployerId: string
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("werknl_employer_id", werknlEmployerId)
    .maybeSingle();
  return data?.id ? { id: data.id } : null;
}

export async function findOrCreateCompanyWerknl(
  supabase: SupabaseClient,
  input: WerknlCompanyInput,
  sourceId: string
): Promise<DedupResult> {
  const normalized = generateNormalizedName(input.name);
  const hoofddomein = extractHoofddomein(input.website);

  // Backfill-patch voor laag 2/3: werknl_employer_id + (monotoon) bemiddelaar-vlag.
  const backfill: Record<string, unknown> = {};
  if (input.werknl_employer_id) backfill.werknl_employer_id = input.werknl_employer_id;
  if (input.is_bemiddelaar) backfill.is_bemiddelaar = true;

  // LAAG 1: werknl_employer_id
  if (input.werknl_employer_id) {
    const l1 = await findByWerknlEmployerId(supabase, input.werknl_employer_id);
    if (l1?.id) return { id: l1.id, matchedLayer: "werknl_employer_id" };
  }

  // LAAG 2: normalized_name
  if (normalized) {
    const { data: l2 } = await supabase
      .from("companies")
      .select("id, werknl_employer_id")
      .eq("normalized_name", normalized)
      .maybeSingle();
    if (l2?.id) {
      const result: DedupResult = { id: l2.id, matchedLayer: "normalized_name" };
      if (Object.keys(backfill).length > 0) {
        const { error } = await supabase.from("companies").update(backfill).eq("id", l2.id);
        if (error) result.conflict = `Layer-2 backfill: ${error.message}`;
      }
      return result;
    }
  }

  // LAAG 3: hoofddomein
  if (hoofddomein) {
    const { data: l3 } = await supabase
      .from("companies")
      .select("id, werknl_employer_id")
      .eq("hoofddomein", hoofddomein)
      .maybeSingle();
    if (l3?.id) {
      const result: DedupResult = { id: l3.id, matchedLayer: "hoofddomein" };
      if (Object.keys(backfill).length > 0) {
        const { error } = await supabase.from("companies").update(backfill).eq("id", l3.id);
        if (error) result.conflict = `Layer-3 backfill: ${error.message}`;
      }
      return result;
    }
  }

  // LAAG 4: CREATE
  const { data: created, error } = await supabase
    .from("companies")
    .insert({
      name: input.name,
      normalized_name: normalized,
      werknl_employer_id: input.werknl_employer_id,
      is_bemiddelaar: input.is_bemiddelaar,
      website: input.website,
      city: input.city,
      street_address: input.street_address,
      postal_code: input.postal_code,
      hoofddomein,
      source: sourceId,
      status: "Prospect",
      enrichment_status: "pending",
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (error || !created) {
    if (input.werknl_employer_id && isUniqueViolation(error)) {
      const raced = await findByWerknlEmployerId(supabase, input.werknl_employer_id);
      if (raced?.id) {
        return {
          id: raced.id,
          matchedLayer: "werknl_employer_id",
          conflict: `Layer-4 create race: ${error?.message ?? "unique violation"}`,
        };
      }
    }
    throw new Error(`[werknl] create company faalde: ${error?.message ?? "geen data"}`);
  }
  return { id: created.id, matchedLayer: "new" };
}
