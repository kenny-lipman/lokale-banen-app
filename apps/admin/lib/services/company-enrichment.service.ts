/**
 * Company Enrichment Service — Single Source of Truth
 *
 * This is the ONLY service that determines and updates:
 * - companies.hoofddomein (based on postal_code → cities/postcode_platform_lookup)
 * - companies.subdomeinen (based on job_postings → platforms, minus hoofddomein)
 *
 * All other services (campaign assignment, Pipedrive sync, postcode backfill)
 * MUST read from companies.hoofddomein instead of computing it themselves.
 *
 * Flow:
 *   postal_code → postcode_platform_lookup → hoofddomein
 *   job_postings → platforms.regio_platform → subdomeinen (minus hoofddomein)
 */

import { createServiceRoleClient } from '../supabase-server';

// ============================================================================
// TYPES
// ============================================================================

export interface PlatformResult {
  hoofddomein: string | null;
  subdomeinen: string[];
  changed: boolean;
}

export interface FullEnrichmentResult extends PlatformResult {
  companyId: string;
  postalCode: string | null;
  pipedriveId: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

// PostgREST levert embedded relations soms als object, soms als array.
function extractRegioPlatform(rel: unknown): string | null {
  if (!rel) return null;
  const obj = Array.isArray(rel) ? rel[0] : rel;
  return (obj as { regio_platform?: string } | null)?.regio_platform ?? null;
}

// ============================================================================
// SERVICE
// ============================================================================

export class CompanyEnrichmentService {
  private supabase = createServiceRoleClient();

  // ============================================================================
  // CORE: HOOFDDOMEIN BEPALING
  // ============================================================================

  /**
   * Look up the regio_platform (Hoofddomein) based on a postal code.
   * Uses postcode_platform_lookup table (pre-computed, includes fuzzy matches).
   * Falls back to cities table with ±20 range if not in lookup.
   *
   * This is the SINGLE function for postal code → platform mapping.
   */
  async getHoofddomeinByPostalCode(postalCode: string): Promise<string | null> {
    if (!postalCode) return null;

    try {
      // Extract first 4 digits (handles "2991 XT" → "2991" and "2991" → "2991")
      const pc4 = postalCode.replace(/\s+/g, '').substring(0, 4);

      if (!/^\d{4}$/.test(pc4)) {
        console.warn(`⚠️ Invalid postal code format: ${postalCode}`);
        return null;
      }

      // Primary: Use pre-computed lookup table (fast, covers all known postcodes)
      const { data: lookupData } = await this.supabase
        .from('postcode_platform_lookup')
        .select('regio_platform, distance')
        .eq('postcode', pc4)
        .limit(1)
        .single();

      if (lookupData?.regio_platform) {
        // Only use fuzzy matches within reasonable distance
        if (lookupData.distance <= 20) {
          return lookupData.regio_platform;
        }
        // For distances > 20, still use it but log a warning
        console.log(`📍 Postcode ${pc4} → ${lookupData.regio_platform} (fuzzy, distance: ${lookupData.distance})`);
        return lookupData.regio_platform;
      }

      // Fallback: Direct cities table query (for newly added cities) — leest via JOIN platforms
      const { data: cityData } = await this.supabase
        .from('cities')
        .select('platforms ( regio_platform )')
        .eq('postcode', pc4)
        .not('platform_id', 'is', null)
        .limit(1)
        .single();

      const cityRegioPlatform = extractRegioPlatform(cityData?.platforms);
      if (cityRegioPlatform) {
        // Add to lookup table for future queries
        await this.supabase
          .from('postcode_platform_lookup')
          .upsert({
            postcode: pc4,
            regio_platform: cityRegioPlatform,
            distance: 0,
            source_postcode: pc4
          });
        return cityRegioPlatform;
      }

      // Last resort: fuzzy search in cities table (±20 range)
      const postcodeNum = parseInt(pc4, 10);
      const { data: nearbyData } = await this.supabase
        .from('cities')
        .select('postcode, platforms ( regio_platform )')
        .gte('postcode', String(postcodeNum - 20).padStart(4, '0'))
        .lte('postcode', String(postcodeNum + 20).padStart(4, '0'))
        .not('platform_id', 'is', null);

      if (nearbyData && nearbyData.length > 0) {
        let closest = nearbyData[0];
        let minDistance = Math.abs(parseInt(closest.postcode || '0', 10) - postcodeNum);

        for (const city of nearbyData) {
          const distance = Math.abs(parseInt(city.postcode || '0', 10) - postcodeNum);
          if (distance < minDistance) {
            minDistance = distance;
            closest = city;
          }
        }

        const closestRegioPlatform = extractRegioPlatform(closest.platforms);
        if (!closestRegioPlatform) return null;

        // Cache in lookup table
        await this.supabase
          .from('postcode_platform_lookup')
          .upsert({
            postcode: pc4,
            regio_platform: closestRegioPlatform,
            distance: minDistance,
            source_postcode: closest.postcode
          });

        return closestRegioPlatform;
      }

      console.log(`📍 No platform found for postal code ${pc4}`);
      return null;
    } catch (error) {
      console.error(`Error looking up platform for postal code ${postalCode}:`, error);
      return null;
    }
  }

  // ============================================================================
  // CORE: SUBDOMEINEN BEPALING
  // ============================================================================

  /**
   * Get all unique regio_platforms from a company's job postings.
   * Returns platforms OTHER than the hoofddomein (those become subdomeinen).
   */
  async getSubdomeinen(companyId: string, hoofddomein: string | null): Promise<string[]> {
    if (!companyId) return [];

    try {
      const { data, error } = await this.supabase
        .from('job_postings')
        .select(`
          platform_id,
          platforms (
            regio_platform
          )
        `)
        .eq('company_id', companyId)
        .not('platform_id', 'is', null);

      if (error || !data || data.length === 0) {
        return [];
      }

      const platforms = data
        .map(jp => (jp.platforms as any)?.regio_platform)
        .filter((p): p is string => !!p);

      const uniquePlatforms = [...new Set(platforms)];

      // Filter out hoofddomein — subdomeinen are all OTHER platforms
      return hoofddomein
        ? uniquePlatforms.filter(p => p !== hoofddomein)
        : uniquePlatforms;
    } catch (error) {
      console.error(`Error getting subdomeinen for company ${companyId}:`, error);
      return [];
    }
  }

  // ============================================================================
  // MAIN: UPDATE COMPANY PLATFORMS
  // ============================================================================

  /**
   * Determine and update hoofddomein + subdomeinen for a company.
   *
   * This is the SINGLE function all services should call after:
   * - Postcode enrichment (new postal_code)
   * - New job postings scraped (new platforms)
   * - On-demand during sync/campaign assignment
   *
   * Returns whether the values changed (useful for triggering Pipedrive updates).
   */
  async updateCompanyPlatforms(companyId: string): Promise<PlatformResult> {
    try {
      // Get current company data
      const { data: company } = await this.supabase
        .from('companies')
        .select('id, postal_code, hoofddomein, subdomeinen')
        .eq('id', companyId)
        .single();

      if (!company) {
        return { hoofddomein: null, subdomeinen: [], changed: false };
      }

      // Determine new hoofddomein from postal code
      const newHoofddomein = company.postal_code
        ? await this.getHoofddomeinByPostalCode(company.postal_code)
        : null;

      // Determine new subdomeinen from job postings
      const newSubdomeinen = await this.getSubdomeinen(companyId, newHoofddomein);

      // Check if anything changed
      const oldSubdomeinen = company.subdomeinen || [];
      const changed = company.hoofddomein !== newHoofddomein ||
        JSON.stringify(oldSubdomeinen.sort()) !== JSON.stringify(newSubdomeinen.sort());

      // Update if changed
      if (changed) {
        await this.supabase
          .from('companies')
          .update({
            hoofddomein: newHoofddomein,
            subdomeinen: newSubdomeinen.length > 0 ? newSubdomeinen : null,
            hoofddomein_updated_at: new Date().toISOString()
          } as any)
          .eq('id', companyId);

        console.log(`📍 Updated company ${companyId}: hoofddomein=${newHoofddomein}, subdomeinen=[${newSubdomeinen.join(', ')}]`);
      }

      return {
        hoofddomein: newHoofddomein,
        subdomeinen: newSubdomeinen,
        changed
      };
    } catch (error) {
      console.error(`Error updating company platforms for ${companyId}:`, error);
      return { hoofddomein: null, subdomeinen: [], changed: false };
    }
  }

  // ============================================================================
  // CONVENIENCE: READ FROM DB (no computation)
  // ============================================================================

  /**
   * Read the current hoofddomein + subdomeinen from the companies table.
   * Use this when you just need to READ the values (not recompute).
   *
   * If hoofddomein is null but postal_code exists, triggers an update first.
   */
  async getCompanyPlatforms(companyId: string): Promise<{
    hoofddomein: string | null;
    subdomeinen: string[];
  }> {
    const { data: company } = await this.supabase
      .from('companies')
      .select('hoofddomein, subdomeinen, postal_code')
      .eq('id', companyId)
      .single();

    if (!company) {
      return { hoofddomein: null, subdomeinen: [] };
    }

    // If we have a postal_code but no hoofddomein, compute it now
    if (!company.hoofddomein && company.postal_code) {
      const result = await this.updateCompanyPlatforms(companyId);
      return {
        hoofddomein: result.hoofddomein,
        subdomeinen: result.subdomeinen
      };
    }

    return {
      hoofddomein: company.hoofddomein,
      subdomeinen: company.subdomeinen || []
    };
  }
}

// Singleton export
export const companyEnrichmentService = new CompanyEnrichmentService();
