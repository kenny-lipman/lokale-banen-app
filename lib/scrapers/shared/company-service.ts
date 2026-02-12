/**
 * Shared company service for all scrapers
 * Handles company creation, lookup, and updates with deduplication
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyData, CompanyResult } from "./types";
import { generateNormalizedName } from "./utils";

/**
 * Find or create a company
 * Uses normalized_name for deduplication (more reliable than ilike)
 *
 * @param supabase - Supabase client
 * @param companyData - Company data to create/update
 * @param sourceId - Job source ID for new companies
 * @returns CompanyResult with id, created, and updated flags
 */
export async function findOrCreateCompany(
  supabase: SupabaseClient,
  companyData: CompanyData,
  sourceId: string
): Promise<CompanyResult> {
  const normalizedName = generateNormalizedName(companyData.name);

  // Try normalized_name match first (more reliable than ilike)
  const { data: existing } = await supabase
    .from("companies")
    .select("id, website, phone, city, location, street_address, postal_code, logo_url")
    .eq("normalized_name", normalizedName)
    .single();

  if (existing) {
    // Update existing company with new data if we have more info
    const updates: Record<string, unknown> = {};

    if (companyData.website && !existing.website) updates.website = companyData.website;
    if (companyData.phone && !existing.phone) updates.phone = companyData.phone;
    if (companyData.city && !existing.city) updates.city = companyData.city;
    if (companyData.location && !existing.location) updates.location = companyData.location;
    if (companyData.street_address && !existing.street_address)
      updates.street_address = companyData.street_address;
    if (companyData.postal_code && !existing.postal_code)
      updates.postal_code = companyData.postal_code;
    if (companyData.logo_url && !existing.logo_url)
      updates.logo_url = companyData.logo_url;

    const wasUpdated = Object.keys(updates).length > 0;
    if (wasUpdated) {
      await supabase.from("companies").update(updates).eq("id", existing.id);
    }

    return { id: existing.id, created: false, updated: wasUpdated };
  }

  // Create new company with normalized_name
  const { data: newCompany, error } = await supabase
    .from("companies")
    .insert({
      name: companyData.name,
      normalized_name: normalizedName,
      city: companyData.city || null,
      location: companyData.location || null,
      street_address: companyData.street_address || null,
      postal_code: companyData.postal_code || null,
      website: companyData.website || null,
      phone: companyData.phone || null,
      logo_url: companyData.logo_url || null,
      source: sourceId,
      status: "Prospect",
      enrichment_status: "pending",
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (error || !newCompany) {
    throw new Error(`Failed to create company: ${error?.message || "No data returned"}`);
  }

  return { id: newCompany.id, created: true, updated: false };
}
