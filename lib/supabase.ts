import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase'

// Singleton pattern for Supabase client
let supabaseClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function createClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey
    })
    throw new Error('Missing Supabase environment variables')
  }

  console.log('Creating Supabase client with:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl.substring(0, 20) + '...'
  })

  try {
    supabaseClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'lokale-banen-auth', // Custom storage key to avoid conflicts
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        flowType: 'pkce' // More secure auth flow
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      global: {
        headers: {
          'X-Client-Info': 'lokale-banen-web'
        }
      }
    })

    console.log('Supabase client created successfully')
    return supabaseClient
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    throw error
  }
}

// Export the singleton instance
export const supabase = createClient()

/**
 * Create a Supabase service role client for server-side operations that bypass RLS.
 * This should only be used in API routes and server-side code.
 */
export const createServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Test connection function
export const testConnection = async () => {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.from("job_postings").select("count", { count: "exact", head: true })

    if (error) {
      console.error("Supabase connection error:", error)
      return { success: false, error: error.message }
    }

    return { success: true, count: data }
  } catch (err) {
    console.error("Connection test failed:", err)
    return { success: false, error: "Failed to connect to Supabase" }
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      apify_runs: {
        Row: {
          actor_id: string | null
          created_at: string | null
          finished_at: string | null
          id: string
          price_per_unit_usd: number | null
          pricingModel: string | null
          region: string | null
          region_id: string | null
          session_id: string | null
          source: string | null
          started_at: string | null
          status: string | null
          status_message: string | null
          title: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          finished_at?: string | null
          id: string
          price_per_unit_usd?: number | null
          pricingModel?: string | null
          region?: string | null
          region_id?: string | null
          session_id?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          status_message?: string | null
          title?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          finished_at?: string | null
          id?: string
          price_per_unit_usd?: number | null
          pricingModel?: string | null
          region?: string | null
          region_id?: string | null
          session_id?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          status_message?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apify_runs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apify_runs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions_with_job_postings_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apify_runs_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apify_runs_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "job_sources_with_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          apollo_contacts_count: number | null
          apollo_enriched_at: string | null
          apollo_enrichment_data: Json | null
          apollo_organization_id: string | null
          category_size: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          enrichment_batch_id: string | null
          enrichment_status: string | null
          id: string
          indeed_url: string | null
          industries: string[] | null
          industry_tag_id: string | null
          is_customer: boolean | null
          job_counts: number | null
          keywords: string[] | null
          "Klant Status company field": string | null
          kvk: string | null
          linkedin_uid: string | null
          linkedin_url: string | null
          location: string | null
          logo_url: string | null
          name: string
          normalized_name: string | null
          phone: string | null
          postal_code: string | null
          rating_indeed: number | null
          raw_address: string | null
          review_count_indeed: number | null
          size_max: number | null
          size_min: number | null
          source: string | null
          "SourceId (CRM)": string | null
          start: string | null
          state: string | null
          status: string | null
          street_address: string | null
          website: string | null
          WeTarget: string | null
        }
        Insert: {
          apollo_contacts_count?: number | null
          apollo_enriched_at?: string | null
          apollo_enrichment_data?: Json | null
          apollo_organization_id?: string | null
          category_size?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          enrichment_batch_id?: string | null
          enrichment_status?: string | null
          id?: string
          indeed_url?: string | null
          industries?: string[] | null
          industry_tag_id?: string | null
          is_customer?: boolean | null
          job_counts?: number | null
          keywords?: string[] | null
          "Klant Status company field"?: string | null
          kvk?: string | null
          linkedin_uid?: string | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          normalized_name?: string | null
          phone?: string | null
          postal_code?: string | null
          rating_indeed?: number | null
          raw_address?: string | null
          review_count_indeed?: number | null
          size_max?: number | null
          size_min?: number | null
          source?: string | null
          "SourceId (CRM)"?: string | null
          start?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          website?: string | null
          WeTarget?: string | null
        }
        Update: {
          apollo_contacts_count?: number | null
          apollo_enriched_at?: string | null
          apollo_enrichment_data?: Json | null
          apollo_organization_id?: string | null
          category_size?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          enrichment_batch_id?: string | null
          enrichment_status?: string | null
          id?: string
          indeed_url?: string | null
          industries?: string[] | null
          industry_tag_id?: string | null
          is_customer?: boolean | null
          job_counts?: number | null
          keywords?: string[] | null
          "Klant Status company field"?: string | null
          kvk?: string | null
          linkedin_uid?: string | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          normalized_name?: string | null
          phone?: string | null
          postal_code?: string | null
          rating_indeed?: number | null
          raw_address?: string | null
          review_count_indeed?: number | null
          size_max?: number | null
          size_min?: number | null
          source?: string | null
          "SourceId (CRM)"?: string | null
          start?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          website?: string | null
          WeTarget?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_enrichment_batch_id_fkey"
            columns: ["enrichment_batch_id"]
            isOneToOne: false
            referencedRelation: "enrichment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "job_sources_with_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_batches: {
        Row: {
          apify_run_id: string | null
          batch_id: string
          completed_at: string | null
          completed_companies: number
          created_at: string | null
          error_message: string | null
          failed_companies: number
          id: string
          started_at: string | null
          status: string
          total_companies: number
          updated_at: string | null
          webhook_payload: Json | null
          webhook_response: Json | null
          webhook_url: string | null
        }
        Insert: {
          apify_run_id?: string | null
          batch_id: string
          completed_at?: string | null
          completed_companies?: number
          created_at?: string | null
          error_message?: string | null
          failed_companies?: number
          id?: string
          started_at?: string | null
          status?: string
          total_companies?: number
          updated_at?: string | null
          webhook_payload?: Json | null
          webhook_response?: Json | null
          webhook_url?: string | null
        }
        Update: {
          apify_run_id?: string | null
          batch_id?: string
          completed_at?: string | null
          completed_companies?: number
          created_at?: string | null
          error_message?: string | null
          failed_companies?: number
          id?: string
          started_at?: string | null
          status?: string
          total_companies?: number
          updated_at?: string | null
          webhook_payload?: Json | null
          webhook_response?: Json | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_batches_apify_run_id_fkey"
            columns: ["apify_run_id"]
            isOneToOne: false
            referencedRelation: "apify_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_batches_apify_run_id_fkey"
            columns: ["apify_run_id"]
            isOneToOne: false
            referencedRelation: "apify_runs_with_platform"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_status: {
        Row: {
          batch_id: string
          company_id: string
          contacts_found: number | null
          created_at: string | null
          enriched_data: Json | null
          error_message: string | null
          id: string
          processed_at: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          status: string
          updated_at: string | null
          webhook_response: Json | null
          website: string | null
        }
        Insert: {
          batch_id: string
          company_id: string
          contacts_found?: number | null
          created_at?: string | null
          enriched_data?: Json | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
          updated_at?: string | null
          webhook_response?: Json | null
          website?: string | null
        }
        Update: {
          batch_id?: string
          company_id?: string
          contacts_found?: number | null
          created_at?: string | null
          enriched_data?: Json | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
          updated_at?: string | null
          webhook_response?: Json | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_status_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "enrichment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_status_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          apollo_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          company_id: string | null
          company_status: string | null
          contact_priority: number | null
          created_at: string | null
          email: string | null
          email_status: string | null
          first_name: string | null
          found_at: string | null
          id: string
          instantly_id: string | null
          is_key_contact: boolean | null
          last_name: string | null
          last_touch: string | null
          linkedin_url: string | null
          name: string | null
          phone: string | null
          qualification_notes: string | null
          qualification_status: string | null
          qualification_timestamp: string | null
          qualified_by_user: string | null
          source: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          apollo_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          company_id?: string | null
          company_status?: string | null
          contact_priority?: number | null
          created_at?: string | null
          email?: string | null
          email_status?: string | null
          first_name?: string | null
          found_at?: string | null
          id?: string
          instantly_id?: string | null
          is_key_contact?: boolean | null
          last_name?: string | null
          last_touch?: string | null
          linkedin_url?: string | null
          name?: string | null
          phone?: string | null
          qualification_notes?: string | null
          qualification_status?: string | null
          qualification_timestamp?: string | null
          qualified_by_user?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
        }
        Update: {
          apollo_id?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          company_id?: string | null
          company_status?: string | null
          contact_priority?: number | null
          created_at?: string | null
          email?: string | null
          email_status?: string | null
          first_name?: string | null
          found_at?: string | null
          id?: string
          instantly_id?: string | null
          is_key_contact?: boolean | null
          last_name?: string | null
          last_touch?: string | null
          linkedin_url?: string | null
          name?: string | null
          phone?: string | null
          qualification_notes?: string | null
          qualification_status?: string | null
          qualification_timestamp?: string | null
          qualified_by_user?: string | null
          source?: string | null
          status?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          apify_run_id: string | null
          company_id: string | null
          content_hash: string | null
          country: string | null
          created_at: string | null
          description: string | null
          external_vacancy_id: string | null
          id: string
          job_type: string[] | null
          location: string | null
          region_id: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salary: string | null
          scraped_at: string | null
          search_vector: unknown | null
          source_id: string | null
          status: string | null
          title: string
          url: string | null
        }
        Insert: {
          apify_run_id?: string | null
          company_id?: string | null
          content_hash?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          external_vacancy_id?: string | null
          id?: string
          job_type?: string[] | null
          location?: string | null
          region_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          scraped_at?: string | null
          search_vector?: unknown | null
          source_id?: string | null
          status?: string | null
          title: string
          url?: string | null
        }
        Update: {
          apify_run_id?: string | null
          company_id?: string | null
          content_hash?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          external_vacancy_id?: string | null
          id?: string
          job_type?: string[] | null
          location?: string | null
          region_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          scraped_at?: string | null
          search_vector?: unknown | null
          source_id?: string | null
          status?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_apify_run_id_fkey"
            columns: ["apify_run_id"]
            isOneToOne: false
            referencedRelation: "apify_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_apify_run_id_fkey"
            columns: ["apify_run_id"]
            isOneToOne: false
            referencedRelation: "apify_runs_with_platform"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions_with_job_postings_count"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "job_sources_with_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string | null
          id: string
          plaats: string
          postcode: string | null
          regio_platform: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plaats: string
          postcode?: string | null
          regio_platform: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plaats?: string
          postcode?: string | null
          regio_platform?: string
        }
        Relationships: []
      }
    }
    Views: {
      apify_runs_with_platform: {
        Row: {
          actor_id: string | null
          created_at: string | null
          finished_at: string | null
          id: string | null
          platform: string | null
          price_per_unit_usd: number | null
          region: string | null
          source: string | null
          started_at: string | null
          status: string | null
          status_message: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apify_runs_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "job_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apify_runs_source_fkey"
            columns: ["source"]
            isOneToOne: false
            referencedRelation: "job_sources_with_postings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
  }
}
