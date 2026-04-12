/**
 * Shared database client for all scrapers
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Create Supabase client with service role for server-side operations
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get or create a job source by name
 * Returns the source ID
 */
export async function getOrCreateJobSource(
  supabase: SupabaseClient,
  sourceName: string,
  scrapingMethod: "local" | "apify" = "local"
): Promise<string> {
  const { data, error } = await supabase
    .from("job_sources")
    .select("id")
    .eq("name", sourceName)
    .single();

  if (error || !data) {
    // Create if not exists
    const { data: newSource, error: insertError } = await supabase
      .from("job_sources")
      .insert({
        name: sourceName,
        active: true,
        scraping_method: scrapingMethod,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create job source: ${insertError.message}`);
    }
    console.log(`Created job source: ${sourceName}`);
    return newSource!.id;
  }

  return data.id;
}

/**
 * Check if a vacancy already exists
 */
export async function vacancyExists(
  supabase: SupabaseClient,
  externalVacancyId: string,
  sourceId: string
): Promise<{ exists: boolean; id?: string }> {
  const { data } = await supabase
    .from("job_postings")
    .select("id")
    .eq("external_vacancy_id", externalVacancyId)
    .eq("source_id", sourceId)
    .single();

  return { exists: !!data, id: data?.id };
}

// Re-export SupabaseClient type for convenience
export type { SupabaseClient };
