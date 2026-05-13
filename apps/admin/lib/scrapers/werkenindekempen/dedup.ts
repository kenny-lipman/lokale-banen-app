/**
 * 3-laagse company-dedup voor werkenindekempen.nl scraper.
 *
 * Match-volgorde (eerste hit wint):
 *   1. companies.werkenindekempen_id = c{id} uit URL
 *   2. companies.normalized_name (cross-source: zelfde werkgever op andere bronnen)
 *   3. companies.hoofddomein (catch-all op website-domain)
 *   4. → CREATE nieuwe row
 *
 * Bij match op laag 2 of 3 backfillen we de werkenindekempen_id op het bestaande record,
 * zodat volgende runs direct laag 1 hit. Cross-source company-graaf bouwt zich zo automatisch op.
 *
 * Bij backfill-conflict (andere rij heeft al deze werkenindekempen_id):
 * we throwen niet, we loggen via DedupResult.conflict en laten de scraper doorgaan.
 * Manual merge kan later.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateNormalizedName } from "@/lib/scrapers/shared/utils";
import { extractHoofddomein } from "./normalizers";

export interface CompanyInput {
  /** "c1913" — c-prefix met company-id uit werkenindekempen URL */
  werkenindekempen_id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  street_address: string | null;
  postal_code: string | null;
  location: string | null;
}

export interface DedupResult {
  id: string;
  matchedLayer: "werkenindekempen_id" | "normalized_name" | "hoofddomein" | "new";
  conflict?: string;
}

export async function findOrCreateCompanyThreeLayer(
  supabase: SupabaseClient,
  input: CompanyInput,
  sourceId: string
): Promise<DedupResult> {
  const normalized = generateNormalizedName(input.name);
  const hoofddomein = extractHoofddomein(input.website);

  // ── LAAG 1: werkenindekempen_id ───────────────────────────────
  const { data: l1 } = await supabase
    .from("companies")
    .select("id")
    .eq("werkenindekempen_id", input.werkenindekempen_id)
    .maybeSingle();
  if (l1?.id) return { id: l1.id, matchedLayer: "werkenindekempen_id" };

  // ── LAAG 2: normalized_name ───────────────────────────────────
  if (normalized) {
    const { data: l2 } = await supabase
      .from("companies")
      .select("id, werkenindekempen_id")
      .eq("normalized_name", normalized)
      .maybeSingle();
    if (l2?.id) {
      const result: DedupResult = { id: l2.id, matchedLayer: "normalized_name" };
      if (!l2.werkenindekempen_id) {
        const { error } = await supabase
          .from("companies")
          .update({ werkenindekempen_id: input.werkenindekempen_id })
          .eq("id", l2.id);
        if (error) result.conflict = `Layer-2 backfill: ${error.message}`;
      }
      return result;
    }
  }

  // ── LAAG 3: hoofddomein ───────────────────────────────────────
  if (hoofddomein) {
    const { data: l3 } = await supabase
      .from("companies")
      .select("id, werkenindekempen_id")
      .eq("hoofddomein", hoofddomein)
      .maybeSingle();
    if (l3?.id) {
      const result: DedupResult = { id: l3.id, matchedLayer: "hoofddomein" };
      if (!l3.werkenindekempen_id) {
        const { error } = await supabase
          .from("companies")
          .update({ werkenindekempen_id: input.werkenindekempen_id })
          .eq("id", l3.id);
        if (error) result.conflict = `Layer-3 backfill: ${error.message}`;
      }
      return result;
    }
  }

  // ── LAAG 4: CREATE ────────────────────────────────────────────
  const { data: created, error } = await supabase
    .from("companies")
    .insert({
      name: input.name,
      normalized_name: normalized,
      werkenindekempen_id: input.werkenindekempen_id,
      website: input.website,
      logo_url: input.logo_url,
      logo_source: input.logo_url ? "werkenindekempen" : null,
      city: input.city,
      state: input.state,
      country: input.country,
      street_address: input.street_address,
      postal_code: input.postal_code,
      location: input.location,
      hoofddomein,
      source: sourceId,
      status: "Prospect",
      enrichment_status: "pending",
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Create company failed: ${error?.message ?? "no data"}`);
  }
  return { id: created.id, matchedLayer: "new" };
}
