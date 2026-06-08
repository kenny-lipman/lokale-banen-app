/**
 * 3-laagse company-dedup voor de werk.nl scraper.
 *
 * Match-volgorde (eerste hit wint):
 *   1. companies.werknl_employer_id = employer.referenceNumber
 *   2. companies.hoofddomein op betrouwbare employer/contact/application-domain
 *   3. normalized_name + adresvelden
 *   4. normalized_name alleen als er een geldige werk.nl employer-id is
 *   5. -> CREATE nieuwe row
 *
 * Bij fallback-match backfillen we alleen geldige werknl_employer_id's en zetten
 * we is_bemiddelaar monotoon op true als de heuristiek dat zegt. Backfill-conflict
 * throwt niet, maar wordt via DedupResult.conflict gemeld.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNormalizedName } from "@/lib/scrapers/shared/utils";
import type { WerknlCompanyInput } from "./detail-mapper";

export interface DedupResult {
  id: string;
  matchedLayer: "werknl_employer_id" | "hoofddomein" | "name_address" | "normalized_name" | "new";
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
  const hoofddomein = input.match_domains[0] ?? null;

  // Backfill-patch: alleen geldige werknl_employer_id's worden teruggeschreven.
  const backfill: Record<string, unknown> = {};
  if (input.werknl_employer_id) backfill.werknl_employer_id = input.werknl_employer_id;
  if (input.is_bemiddelaar) backfill.is_bemiddelaar = true;

  // LAAG 1: werknl_employer_id
  if (input.werknl_employer_id) {
    const l1 = await findByWerknlEmployerId(supabase, input.werknl_employer_id);
    if (l1?.id) return { id: l1.id, matchedLayer: "werknl_employer_id" };
  }

  // LAAG 2: betrouwbaar hoofddomein uit employer.website/contact/app-url.
  for (const domain of input.match_domains) {
    const { data: domainHit } = await supabase
      .from("companies")
      .select("id, werknl_employer_id")
      .eq("hoofddomein", domain)
      .maybeSingle();
    if (domainHit?.id) {
      const result: DedupResult = { id: domainHit.id, matchedLayer: "hoofddomein" };
      if (Object.keys(backfill).length > 0) {
        const { error } = await supabase.from("companies").update(backfill).eq("id", domainHit.id);
        if (error) result.conflict = `Domain backfill: ${error.message}`;
      }
      return result;
    }
  }

  // LAAG 3: naam + adres. Dit is bewust strenger dan alleen normalized_name.
  if (normalized && input.postal_code && input.street_address) {
    const { data: l2 } = await supabase
      .from("companies")
      .select("id, werknl_employer_id")
      .eq("normalized_name", normalized)
      .eq("postal_code", input.postal_code)
      .eq("street_address", input.street_address)
      .maybeSingle();
    if (l2?.id) {
      const result: DedupResult = { id: l2.id, matchedLayer: "name_address" };
      if (Object.keys(backfill).length > 0) {
        const { error } = await supabase.from("companies").update(backfill).eq("id", l2.id);
        if (error) result.conflict = `Name-address backfill: ${error.message}`;
      }
      return result;
    }
  }

  // LAAG 4: normalized_name alleen gebruiken als we daarna een geldige employer-id kunnen backfillen.
  if (normalized && input.werknl_employer_id) {
    const { data: l4 } = await supabase
      .from("companies")
      .select("id, werknl_employer_id")
      .eq("normalized_name", normalized)
      .maybeSingle();
    if (l4?.id) {
      const result: DedupResult = { id: l4.id, matchedLayer: "normalized_name" };
      if (Object.keys(backfill).length > 0) {
        const { error } = await supabase.from("companies").update(backfill).eq("id", l4.id);
        if (error) result.conflict = `Layer-4 backfill: ${error.message}`;
      }
      return result;
    }
  }

  // LAAG 5: CREATE
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
