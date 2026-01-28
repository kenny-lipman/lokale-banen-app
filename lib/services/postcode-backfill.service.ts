/**
 * Postcode Backfill Service
 *
 * Autonomous system for enriching company postal codes using Nominatim geocoding.
 *
 * Priority Queue:
 * 1. Companies already in Pipedrive (fix hoofddomein/subdomeinen)
 * 2. Companies with contacts in active Instantly campaigns
 * 3. All other companies without postal codes
 *
 * Features:
 * - Batch processing for cron jobs (1 req/sec rate limit)
 * - On-demand enrichment for sync operations
 * - Automatic Pipedrive hoofddomein/subdomeinen correction after enrichment
 */

import { createServiceRoleClient } from '../supabase-server';
import { GeocodingService } from '../geocoding-service';
import { pipedriveClient } from '../pipedrive-client';

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentResult {
  success: boolean;
  postcode: string | null;
  source: 'nominatim_city' | 'nominatim_job_location' | 'nominatim_job_street_city' | 'nominatim_company_location' | 'nominatim_company_name' | 'nominatim_business' | null;
  city?: string | null;
  error?: string;
}

export interface BatchResult {
  processed: number;
  enriched: number;
  failed: number;
  skipped: number;
  pipedriveUpdated: number;
  errors: Array<{ companyId: string; error: string }>;
}

interface CompanyToEnrich {
  id: string;
  name: string | null;
  city: string | null;
  pipedrive_id: string | number | null; // Can be string from Supabase, number when used
}

// ============================================================================
// POSTCODE BACKFILL SERVICE
// ============================================================================

export class PostcodeBackfillService {
  private supabase = createServiceRoleClient();

  // ============================================================================
  // PRIORITY QUEUE
  // ============================================================================

  /**
   * Get companies to process in priority order:
   * 1. Companies in Pipedrive without postal code (fix existing orgs)
   * 2. Companies with contacts in active campaigns
   * 3. All other companies without postal code
   */
  async getCompaniesToProcess(limit: number): Promise<CompanyToEnrich[]> {
    const companies: CompanyToEnrich[] = [];
    let remaining = limit;

    // Priority 1: Companies already in Pipedrive
    if (remaining > 0) {
      const { data: pipedriveCompanies } = await this.supabase
        .from('companies')
        .select('id, name, city, pipedrive_id')
        .not('pipedrive_id', 'is', null)
        .or('postal_code.is.null,postal_code.eq.')
        .is('postcode_geocoded_at', null) // Not yet attempted
        .order('pipedrive_synced_at', { ascending: false, nullsFirst: false })
        .limit(remaining);

      if (pipedriveCompanies && pipedriveCompanies.length > 0) {
        companies.push(...pipedriveCompanies);
        remaining -= pipedriveCompanies.length;
        console.log(`📊 Priority 1: Found ${pipedriveCompanies.length} Pipedrive companies without postcode`);
      }
    }

    // Priority 2: Companies with contacts in active campaigns
    if (remaining > 0) {
      const { data: campaignCompanies } = await this.supabase
        .from('companies')
        .select(`
          id, name, city, pipedrive_id,
          contacts!inner(instantly_campaign_ids)
        `)
        .is('pipedrive_id', null)
        .or('postal_code.is.null,postal_code.eq.')
        .is('postcode_geocoded_at', null)
        .not('contacts.instantly_campaign_ids', 'is', null)
        .limit(remaining);

      if (campaignCompanies && campaignCompanies.length > 0) {
        // Filter out duplicates that might already be in the list
        const existingIds = new Set(companies.map(c => c.id));
        const newCompanies = campaignCompanies.filter(c => !existingIds.has(c.id));
        companies.push(...newCompanies.map(c => ({
          id: c.id,
          name: c.name,
          city: c.city,
          pipedrive_id: c.pipedrive_id
        })));
        remaining -= newCompanies.length;
        console.log(`📊 Priority 2: Found ${newCompanies.length} campaign companies without postcode`);
      }
    }

    // Priority 3: All other companies without postal code
    // Note: This excludes Priority 2 companies (those with campaign contacts) since they have pipedrive_id = null
    // but are already handled above
    if (remaining > 0) {
      const existingIds = new Set(companies.map(c => c.id));

      const { data: otherCompanies } = await this.supabase
        .from('companies')
        .select('id, name, city, pipedrive_id')
        .is('pipedrive_id', null)
        .or('postal_code.is.null,postal_code.eq.')
        .is('postcode_geocoded_at', null)
        .order('created_at', { ascending: false })
        .limit(remaining + existingIds.size + 100); // Get extra to account for filtering

      if (otherCompanies && otherCompanies.length > 0) {
        const newCompanies = otherCompanies.filter(c => !existingIds.has(c.id)).slice(0, remaining);
        companies.push(...newCompanies);
        console.log(`📊 Priority 3: Found ${newCompanies.length} other companies without postcode`);
      }
    }

    return companies;
  }

  // ============================================================================
  // LOCATION DETERMINATION
  // ============================================================================

  /**
   * Determine the best location data to geocode for a company
   * Returns street+city if available (most accurate), otherwise just city/location
   *
   * Priority:
   * 1. Job posting with street + city (best for accurate postcode)
   * 2. Company city
   * 3. Most common job posting location
   */
  async determineBestLocationData(companyId: string): Promise<{
    street: string | null;
    city: string | null;
    source: 'job_street_city' | 'company_city' | 'company_location' | 'job_location' | 'company_name' | null;
  }> {
    // First: Check job postings for street + city combination (most accurate)
    const { data: jobsWithStreet } = await this.supabase
      .from('job_postings')
      .select('street, city')
      .eq('company_id', companyId)
      .not('street', 'is', null)
      .neq('street', '')
      .not('city', 'is', null)
      .neq('city', '')
      .limit(1);

    if (jobsWithStreet && jobsWithStreet.length > 0 && jobsWithStreet[0].street && jobsWithStreet[0].city) {
      return {
        street: jobsWithStreet[0].street,
        city: jobsWithStreet[0].city,
        source: 'job_street_city'
      };
    }

    // Second: Check company city or location field
    const { data: company } = await this.supabase
      .from('companies')
      .select('city, location')
      .eq('id', companyId)
      .single();

    if (company?.city) {
      return {
        street: null,
        city: company.city,
        source: 'company_city'
      };
    }

    // Third: Check company.location field (often contains city name from Pipedrive)
    if (company?.location) {
      return {
        street: null,
        city: company.location,
        source: 'company_location'
      };
    }

    // Fourth: Fall back to most common job posting location
    const { data: locations } = await this.supabase
      .from('job_postings')
      .select('location')
      .eq('company_id', companyId)
      .not('location', 'is', null);

    if (locations && locations.length > 0) {
      // Find most common location
      const locationCounts = new Map<string, number>();
      for (const loc of locations) {
        if (loc.location) {
          const cleaned = loc.location.trim().toLowerCase();
          locationCounts.set(cleaned, (locationCounts.get(cleaned) || 0) + 1);
        }
      }

      if (locationCounts.size > 0) {
        // Get the most frequent location
        let maxCount = 0;
        let mostCommon = '';
        for (const [location, count] of locationCounts) {
          if (count > maxCount) {
            maxCount = count;
            mostCommon = location;
          }
        }

        // Return original casing from first match
        const originalLocation = locations.find(l => l.location?.trim().toLowerCase() === mostCommon)?.location || null;

        if (originalLocation) {
          return {
            street: null,
            city: originalLocation,
            source: 'job_location'
          };
        }
      }
    }

    // Fifth: Last resort - try to extract city name from company name
    const cityFromName = await this.extractCityFromCompanyName(companyId);
    if (cityFromName) {
      return {
        street: null,
        city: cityFromName,
        source: 'company_name'
      };
    }

    return { street: null, city: null, source: null };
  }

  /**
   * Try to extract a Dutch city name from the company name
   * by matching against known city names in our database
   */
  private async extractCityFromCompanyName(companyId: string): Promise<string | null> {
    // Get the company name
    const { data: company } = await this.supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    if (!company?.name) return null;

    const companyName = company.name.toLowerCase();

    // Get all unique city names from our cities table
    const { data: cities } = await this.supabase
      .from('cities')
      .select('plaats')
      .not('plaats', 'is', null);

    if (!cities || cities.length === 0) return null;

    // Build a set of unique city names (lowercase for matching)
    const cityNames = new Map<string, string>(); // lowercase -> original
    for (const c of cities) {
      if (c.plaats) {
        cityNames.set(c.plaats.toLowerCase(), c.plaats);
      }
    }

    // Sort by length (longest first) to match more specific names first
    // e.g., "Bergen op Zoom" before "Bergen"
    const sortedCityNames = Array.from(cityNames.keys()).sort((a, b) => b.length - a.length);

    // Try to find a city name in the company name
    for (const cityLower of sortedCityNames) {
      // Skip very short city names to avoid false positives (e.g., "Ee", "Bant")
      if (cityLower.length < 4) continue;

      // Check if city name appears as a word boundary in company name
      // This handles cases like "AEY Tilburg" or "Bakkerij Almere"
      const regex = new RegExp(`\\b${cityLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(companyName)) {
        const originalCity = cityNames.get(cityLower);
        console.log(`📍 Extracted city "${originalCity}" from company name "${company.name}"`);
        return originalCity || null;
      }
    }

    return null;
  }

  /**
   * @deprecated Use determineBestLocationData instead
   */
  async determineBestLocation(companyId: string): Promise<string | null> {
    const data = await this.determineBestLocationData(companyId);
    return data.city;
  }

  // ============================================================================
  // SINGLE COMPANY ENRICHMENT
  // ============================================================================

  /**
   * Enrich a single company's postal code
   * Used for on-demand enrichment during sync operations
   *
   * Strategy:
   * 1. If job posting has street + city → use geocodeStreetCity (most accurate)
   * 2. If company has city → use geocodeCity (with fallbacks like "Markt 1, {city}")
   * 3. If job posting has location → use geocodeCity
   * 4. If company name extractable city → use geocodeCity
   * 5. FALLBACK: If GOOGLE_MAPS_API_KEY is set → search by business name (costs money!)
   */
  async enrichCompanyPostcode(companyId: string): Promise<EnrichmentResult> {
    try {
      // Get current company data
      const { data: company } = await this.supabase
        .from('companies')
        .select('id, name, city, postal_code, pipedrive_id')
        .eq('id', companyId)
        .single();

      if (!company) {
        return { success: false, postcode: null, source: null, error: 'Company not found' };
      }

      // If already has postal code, return it
      if (company.postal_code && company.postal_code.trim() !== '') {
        return { success: true, postcode: company.postal_code, source: null };
      }

      // Determine best location data to geocode
      const locationData = await this.determineBestLocationData(companyId);

      // If we have location data, try Nominatim first (free)
      if (locationData.source && locationData.city) {
        let geocodeResult;
        let source: 'nominatim_city' | 'nominatim_job_location' | 'nominatim_job_street_city' | 'nominatim_company_location' | 'nominatim_company_name';

        if (locationData.street && locationData.city && locationData.source === 'job_street_city') {
          geocodeResult = await GeocodingService.geocodeStreetCity(locationData.street, locationData.city);
          source = 'nominatim_job_street_city';
        } else if (locationData.source === 'company_city') {
          geocodeResult = await GeocodingService.geocodeCity(locationData.city);
          source = 'nominatim_city';
        } else if (locationData.source === 'company_location') {
          geocodeResult = await GeocodingService.geocodeCity(locationData.city);
          source = 'nominatim_company_location';
        } else if (locationData.source === 'company_name') {
          geocodeResult = await GeocodingService.geocodeCity(locationData.city);
          source = 'nominatim_company_name';
        } else {
          geocodeResult = await GeocodingService.geocodeCity(locationData.city);
          source = 'nominatim_job_location';
        }

        if (geocodeResult?.postcode) {
          // Success with Nominatim!
          await this.supabase
            .from('companies')
            .update({
              postal_code: geocodeResult.postcode,
              postcode_geocoded_at: new Date().toISOString(),
              postcode_geocode_source: source,
              ...((!company.city && geocodeResult.city) ? { city: geocodeResult.city } : {})
            } as any)
            .eq('id', companyId);

          const locationDesc = locationData.street
            ? `${locationData.street}, ${locationData.city}`
            : locationData.city;

          console.log(`✅ Enriched company ${company.name || companyId}: postcode=${geocodeResult.postcode}, source=${source}, location="${locationDesc}"`);

          return {
            success: true,
            postcode: geocodeResult.postcode,
            source,
            city: geocodeResult.city
          };
        }
      }

      // FALLBACK: Try Nominatim business name search - FREE!
      if (company.name) {
        console.log(`🔍 No location data found, trying Nominatim business search for "${company.name}"...`);

        const nominatimResult = await GeocodingService.geocodeBusinessName(company.name);

        if (nominatimResult?.postcode) {
          await this.supabase
            .from('companies')
            .update({
              postal_code: nominatimResult.postcode,
              postcode_geocoded_at: new Date().toISOString(),
              postcode_geocode_source: 'nominatim_business',
              ...((!company.city && nominatimResult.city) ? { city: nominatimResult.city } : {})
            } as any)
            .eq('id', companyId);

          console.log(`✅ Enriched company ${company.name} via Nominatim business search: postcode=${nominatimResult.postcode}`);

          return {
            success: true,
            postcode: nominatimResult.postcode,
            source: 'nominatim_business',
            city: nominatimResult.city
          };
        }
      }

      // All methods failed - mark as attempted
      await this.supabase
        .from('companies')
        .update({
          postcode_geocoded_at: new Date().toISOString(),
          postcode_geocode_source: 'failed_all_methods'
        } as any)
        .eq('id', companyId);

      const errorMsg = locationData.city
        ? `Could not geocode location: ${locationData.city}`
        : 'No location data available and Nominatim business search failed';

      return { success: false, postcode: null, source: null, error: errorMsg };

    } catch (error) {
      console.error(`Error enriching company ${companyId}:`, error);
      return {
        success: false,
        postcode: null,
        source: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // PIPEDRIVE HOOFDDOMEIN FIX
  // ============================================================================

  /**
   * Fix Pipedrive organization's hoofddomein and subdomeinen after postcode enrichment
   */
  async fixPipedriveHoofddomein(
    companyId: string,
    pipedriveId: number,
    newPostcode: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Import sync service dynamically to avoid circular dependency
      const { instantlyPipedriveSyncService } = await import('./instantly-pipedrive-sync.service');

      // Get correct hoofddomein based on new postcode
      const hoofddomein = await instantlyPipedriveSyncService.getRegioPlatformByPostalCode(newPostcode);

      if (!hoofddomein) {
        console.log(`⚠️ Could not determine hoofddomein for postcode ${newPostcode}`);
        return { success: false, error: `No region found for postcode ${newPostcode}` };
      }

      // Get all platforms from job postings for subdomeinen
      const subdomeinen = await instantlyPipedriveSyncService.getAllCompanyPlatforms(companyId);

      // Filter out hoofddomein from subdomeinen
      const filteredSubdomeinen = subdomeinen.filter(p => p !== hoofddomein);

      console.log(`📍 Fixing Pipedrive org ${pipedriveId}: hoofddomein=${hoofddomein}, subdomeinen=[${filteredSubdomeinen.join(', ')}]`);

      // Update Pipedrive organization
      await pipedriveClient.setOrganizationHoofddomein(pipedriveId, hoofddomein);

      if (filteredSubdomeinen.length > 0) {
        await pipedriveClient.setOrganizationSubdomein(pipedriveId, filteredSubdomeinen);
      }

      console.log(`✅ Fixed Pipedrive org ${pipedriveId} with hoofddomein=${hoofddomein}`);

      return { success: true };

    } catch (error) {
      console.error(`Error fixing Pipedrive org ${pipedriveId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // BATCH PROCESSING
  // ============================================================================

  /**
   * Process a batch of companies
   * Used by the cron job for background processing
   *
   * Rate limit: 1 request per second to Nominatim
   */
  async processBatch(limit: number = 50): Promise<BatchResult> {
    const result: BatchResult = {
      processed: 0,
      enriched: 0,
      failed: 0,
      skipped: 0,
      pipedriveUpdated: 0,
      errors: []
    };

    try {
      // Get companies to process in priority order
      const companies = await this.getCompaniesToProcess(limit);

      if (companies.length === 0) {
        console.log('📭 No companies to process for postcode backfill');
        return result;
      }

      console.log(`🔄 Starting postcode backfill batch: ${companies.length} companies`);

      for (const company of companies) {
        result.processed++;

        try {
          // Enrich company postal code (includes 1 second delay for rate limiting)
          const enrichment = await this.enrichCompanyPostcode(company.id);

          if (enrichment.success && enrichment.postcode) {
            result.enriched++;

            // If company is in Pipedrive, fix hoofddomein/subdomeinen
            if (company.pipedrive_id) {
              const pipedriveIdNum = typeof company.pipedrive_id === 'string'
                ? parseInt(company.pipedrive_id, 10)
                : company.pipedrive_id;

              const pipedriveResult = await this.fixPipedriveHoofddomein(
                company.id,
                pipedriveIdNum,
                enrichment.postcode
              );

              if (pipedriveResult.success) {
                result.pipedriveUpdated++;
              } else {
                console.log(`⚠️ Could not fix Pipedrive org ${pipedriveIdNum}: ${pipedriveResult.error}`);
              }
            }

          } else if (enrichment.error) {
            result.failed++;
            result.errors.push({
              companyId: company.id,
              error: enrichment.error
            });
          } else {
            result.skipped++;
          }

        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            companyId: company.id,
            error: errorMessage
          });
          console.error(`Error processing company ${company.id}:`, error);
        }
      }

      console.log(`🏁 Postcode backfill batch complete:`, {
        processed: result.processed,
        enriched: result.enriched,
        failed: result.failed,
        skipped: result.skipped,
        pipedriveUpdated: result.pipedriveUpdated
      });

      return result;

    } catch (error) {
      console.error('Error in postcode backfill batch:', error);
      throw error;
    }
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get statistics on postcode backfill progress
   */
  async getStats(): Promise<{
    total: number;
    withPostcode: number;
    withoutPostcode: number;
    pipedriveWithoutPostcode: number;
    campaignWithoutPostcode: number;
    geocodedToday: number;
    failedToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get counts
    const [
      { count: total },
      { count: withPostcode },
      { count: pipedriveWithoutPostcode },
      { count: geocodedToday },
      { count: failedToday }
    ] = await Promise.all([
      this.supabase.from('companies').select('*', { count: 'exact', head: true }),
      this.supabase.from('companies').select('*', { count: 'exact', head: true })
        .not('postal_code', 'is', null)
        .neq('postal_code', ''),
      this.supabase.from('companies').select('*', { count: 'exact', head: true })
        .not('pipedrive_id', 'is', null)
        .or('postal_code.is.null,postal_code.eq.'),
      this.supabase.from('companies').select('*', { count: 'exact', head: true })
        .gte('postcode_geocoded_at', todayISO)
        .not('postal_code', 'is', null),
      this.supabase.from('companies').select('*', { count: 'exact', head: true })
        .gte('postcode_geocoded_at', todayISO)
        .like('postcode_geocode_source', 'failed%')
    ]);

    // Campaign without postcode (separate query due to join)
    // Note: We need to fetch data (not just count) because joins with count don't work well
    const { count: campaignCount } = await this.supabase
      .from('companies')
      .select(`
        id,
        contacts!inner(instantly_campaign_ids)
      `, { count: 'exact', head: true })
      .is('pipedrive_id', null)
      .or('postal_code.is.null,postal_code.eq.')
      .not('contacts.instantly_campaign_ids', 'is', null);

    const campaignWithoutPostcode = campaignCount || 0;

    return {
      total: total || 0,
      withPostcode: withPostcode || 0,
      withoutPostcode: (total || 0) - (withPostcode || 0),
      pipedriveWithoutPostcode: pipedriveWithoutPostcode || 0,
      campaignWithoutPostcode,
      geocodedToday: geocodedToday || 0,
      failedToday: failedToday || 0
    };
  }
}

// Singleton export
export const postcodeBackfillService = new PostcodeBackfillService();
