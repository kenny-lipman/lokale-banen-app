import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Singleton instance to prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null

/**
 * Create a Supabase client for client-side operations.
 * This client will automatically handle authentication headers and session management.
 * Uses singleton pattern to prevent multiple GoTrueClient instances.
 */
export function createClient() {
  // Return existing instance if it exists
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  // Create and cache the instance
  supabaseInstance = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'lokale-banen-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce'
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

  return supabaseInstance
}

/**
 * Get the authenticated Supabase client instance.
 * Returns the singleton instance to prevent multiple GoTrueClient instances.
 */
export function getSupabaseClient() {
  return createClient()
}

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
  // Allows to automatically instantiate createClient with right options
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
          platform_id: string | null
          price_per_unit_usd: number | null
          pricingModel: string | null
          processed_at: string | null
          processed_by: string | null
          processing_notes: string | null
          processing_status:
            | Database["public"]["Enums"]["processing_status_enum"]
            | null
          region: string | null
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
          platform_id?: string | null
          price_per_unit_usd?: number | null
          pricingModel?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
          processing_status?:
            | Database["public"]["Enums"]["processing_status_enum"]
            | null
          region?: string | null
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
          platform_id?: string | null
          price_per_unit_usd?: number | null
          pricingModel?: string | null
          processed_at?: string | null
          processed_by?: string | null
          processing_notes?: string | null
          processing_status?:
            | Database["public"]["Enums"]["processing_status_enum"]
            | null
          region?: string | null
          session_id?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          status_message?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apify_runs_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
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
      blocklist_entries: {
        Row: {
          block_type: string | null
          blocklist_level: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          instantly_error: string | null
          instantly_id: string | null
          instantly_synced: boolean | null
          instantly_synced_at: string | null
          is_active: boolean | null
          pipedrive_error: string | null
          pipedrive_synced: boolean | null
          pipedrive_synced_at: string | null
          reason: string
          type: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          block_type?: string | null
          blocklist_level?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          instantly_error?: string | null
          instantly_id?: string | null
          instantly_synced?: boolean | null
          instantly_synced_at?: string | null
          is_active?: boolean | null
          pipedrive_error?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          reason: string
          type: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          block_type?: string | null
          blocklist_level?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          instantly_error?: string | null
          instantly_id?: string | null
          instantly_synced?: boolean | null
          instantly_synced_at?: string | null
          is_active?: boolean | null
          pipedrive_error?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          reason?: string
          type?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocklist_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocklist_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocklist_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_optimized"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          plaats: string
          platform_id: string | null
          postcode: string | null
          regio_platform: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          plaats: string
          platform_id?: string | null
          postcode?: string | null
          regio_platform: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          plaats?: string
          platform_id?: string | null
          postcode?: string | null
          regio_platform?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cities_platforms"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          apify_run_id: string | null
          apollo_contacts_count: number | null
          apollo_employees_estimate: number | null
          apollo_enriched_at: string | null
          apollo_enrichment_data: Json | null
          apollo_organization_id: string | null
          campaign_reply_rate: number | null
          category_size: string | null
          city: string | null
          contacts_in_campaign: number | null
          country: string | null
          created_at: string | null
          description: string | null
          enrichment_batch_id: string | null
          enrichment_completed_at: string | null
          enrichment_error_message: string | null
          enrichment_started_at: string | null
          enrichment_status: string | null
          geocoded_at: string | null
          geocoding_source: string | null
          id: string
          indeed_url: string | null
          industries: string[] | null
          industry_tag_id: string | null
          instantly_avg_engagement_score: number | null
          instantly_last_activity_at: string | null
          instantly_meetings_booked: number | null
          instantly_total_bounces: number | null
          instantly_total_clicks: number | null
          instantly_total_leads: number | null
          instantly_total_opens: number | null
          instantly_total_replies: number | null
          is_customer: boolean | null
          job_counts: number | null
          keywords: string[] | null
          "Klant Status company field": string | null
          kvk: string | null
          last_enrichment_batch_id: string | null
          latitude: number | null
          linkedin_uid: string | null
          linkedin_url: string | null
          location: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          nominatim_success: boolean | null
          normalized_name: string | null
          phone: string | null
          pipedrive_id: string | null
          pipedrive_synced: boolean | null
          pipedrive_synced_at: string | null
          postal_code: string | null
          qualification_notes: string | null
          qualification_status: string | null
          qualification_timestamp: string | null
          qualified_by_user: string | null
          rating_indeed: number | null
          raw_address: string | null
          rechtsvorm: string | null
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
          apify_run_id?: string | null
          apollo_contacts_count?: number | null
          apollo_employees_estimate?: number | null
          apollo_enriched_at?: string | null
          apollo_enrichment_data?: Json | null
          apollo_organization_id?: string | null
          campaign_reply_rate?: number | null
          category_size?: string | null
          city?: string | null
          contacts_in_campaign?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          enrichment_batch_id?: string | null
          enrichment_completed_at?: string | null
          enrichment_error_message?: string | null
          enrichment_started_at?: string | null
          enrichment_status?: string | null
          geocoded_at?: string | null
          geocoding_source?: string | null
          id?: string
          indeed_url?: string | null
          industries?: string[] | null
          industry_tag_id?: string | null
          instantly_avg_engagement_score?: number | null
          instantly_last_activity_at?: string | null
          instantly_meetings_booked?: number | null
          instantly_total_bounces?: number | null
          instantly_total_clicks?: number | null
          instantly_total_leads?: number | null
          instantly_total_opens?: number | null
          instantly_total_replies?: number | null
          is_customer?: boolean | null
          job_counts?: number | null
          keywords?: string[] | null
          "Klant Status company field"?: string | null
          kvk?: string | null
          last_enrichment_batch_id?: string | null
          latitude?: number | null
          linkedin_uid?: string | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          nominatim_success?: boolean | null
          normalized_name?: string | null
          phone?: string | null
          pipedrive_id?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          postal_code?: string | null
          qualification_notes?: string | null
          qualification_status?: string | null
          qualification_timestamp?: string | null
          qualified_by_user?: string | null
          rating_indeed?: number | null
          raw_address?: string | null
          rechtsvorm?: string | null
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
          apify_run_id?: string | null
          apollo_contacts_count?: number | null
          apollo_employees_estimate?: number | null
          apollo_enriched_at?: string | null
          apollo_enrichment_data?: Json | null
          apollo_organization_id?: string | null
          campaign_reply_rate?: number | null
          category_size?: string | null
          city?: string | null
          contacts_in_campaign?: number | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          enrichment_batch_id?: string | null
          enrichment_completed_at?: string | null
          enrichment_error_message?: string | null
          enrichment_started_at?: string | null
          enrichment_status?: string | null
          geocoded_at?: string | null
          geocoding_source?: string | null
          id?: string
          indeed_url?: string | null
          industries?: string[] | null
          industry_tag_id?: string | null
          instantly_avg_engagement_score?: number | null
          instantly_last_activity_at?: string | null
          instantly_meetings_booked?: number | null
          instantly_total_bounces?: number | null
          instantly_total_clicks?: number | null
          instantly_total_leads?: number | null
          instantly_total_opens?: number | null
          instantly_total_replies?: number | null
          is_customer?: boolean | null
          job_counts?: number | null
          keywords?: string[] | null
          "Klant Status company field"?: string | null
          kvk?: string | null
          last_enrichment_batch_id?: string | null
          latitude?: number | null
          linkedin_uid?: string | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          nominatim_success?: boolean | null
          normalized_name?: string | null
          phone?: string | null
          pipedrive_id?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          postal_code?: string | null
          qualification_notes?: string | null
          qualification_status?: string | null
          qualification_timestamp?: string | null
          qualified_by_user?: string | null
          rating_indeed?: number | null
          raw_address?: string | null
          rechtsvorm?: string | null
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
            foreignKeyName: "companies_apify_run_id_fkey"
            columns: ["apify_run_id"]
            isOneToOne: false
            referencedRelation: "apify_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_apify_run_id_fkey"
            columns: ["apify_run_id"]
            isOneToOne: false
            referencedRelation: "apify_runs_with_platform"
            referencedColumns: ["id"]
          },
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
      contacts: {
        Row: {
          apollo_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          company_id: string | null
          company_status: string | null
          confidence_score_ai: number | null
          contact_priority: number | null
          created_at: string | null
          email: string | null
          email_status: string | null
          first_name: string | null
          found_at: string | null
          id: string
          instantly_bounced: boolean | null
          instantly_bounced_at: string | null
          instantly_campaign_ids: string[] | null
          instantly_clicks_count: number | null
          instantly_closed_won: boolean | null
          instantly_closed_won_at: string | null
          instantly_current_step: number | null
          instantly_engagement_score: number | null
          instantly_id: string | null
          instantly_last_click_at: string | null
          instantly_last_open_at: string | null
          instantly_meeting_booked: boolean | null
          instantly_meeting_booked_at: string | null
          instantly_meeting_completed: boolean | null
          instantly_meeting_completed_at: string | null
          instantly_opens_count: number | null
          instantly_out_of_office: boolean | null
          instantly_removed_at: string | null
          instantly_status: string | null
          instantly_synced: boolean | null
          instantly_synced_at: string | null
          instantly_unsubscribed: boolean | null
          instantly_unsubscribed_at: string | null
          instantly_verification_status: string | null
          instantly_wrong_person: boolean | null
          is_blocked: boolean | null
          is_key_contact: boolean | null
          last_name: string | null
          last_reply_at: string | null
          last_touch: string | null
          linkedin_url: string | null
          name: string | null
          phone: string | null
          pipedrive_person_id: string | null
          pipedrive_synced: boolean | null
          pipedrive_synced_at: string | null
          qualification_notes: string | null
          qualification_status: string
          qualification_timestamp: string | null
          qualified_by_user: string | null
          reply_count: number | null
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
          confidence_score_ai?: number | null
          contact_priority?: number | null
          created_at?: string | null
          email?: string | null
          email_status?: string | null
          first_name?: string | null
          found_at?: string | null
          id?: string
          instantly_bounced?: boolean | null
          instantly_bounced_at?: string | null
          instantly_campaign_ids?: string[] | null
          instantly_clicks_count?: number | null
          instantly_closed_won?: boolean | null
          instantly_closed_won_at?: string | null
          instantly_current_step?: number | null
          instantly_engagement_score?: number | null
          instantly_id?: string | null
          instantly_last_click_at?: string | null
          instantly_last_open_at?: string | null
          instantly_meeting_booked?: boolean | null
          instantly_meeting_booked_at?: string | null
          instantly_meeting_completed?: boolean | null
          instantly_meeting_completed_at?: string | null
          instantly_opens_count?: number | null
          instantly_out_of_office?: boolean | null
          instantly_removed_at?: string | null
          instantly_status?: string | null
          instantly_synced?: boolean | null
          instantly_synced_at?: string | null
          instantly_unsubscribed?: boolean | null
          instantly_unsubscribed_at?: string | null
          instantly_verification_status?: string | null
          instantly_wrong_person?: boolean | null
          is_blocked?: boolean | null
          is_key_contact?: boolean | null
          last_name?: string | null
          last_reply_at?: string | null
          last_touch?: string | null
          linkedin_url?: string | null
          name?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          qualification_notes?: string | null
          qualification_status?: string
          qualification_timestamp?: string | null
          qualified_by_user?: string | null
          reply_count?: number | null
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
          confidence_score_ai?: number | null
          contact_priority?: number | null
          created_at?: string | null
          email?: string | null
          email_status?: string | null
          first_name?: string | null
          found_at?: string | null
          id?: string
          instantly_bounced?: boolean | null
          instantly_bounced_at?: string | null
          instantly_campaign_ids?: string[] | null
          instantly_clicks_count?: number | null
          instantly_closed_won?: boolean | null
          instantly_closed_won_at?: string | null
          instantly_current_step?: number | null
          instantly_engagement_score?: number | null
          instantly_id?: string | null
          instantly_last_click_at?: string | null
          instantly_last_open_at?: string | null
          instantly_meeting_booked?: boolean | null
          instantly_meeting_booked_at?: string | null
          instantly_meeting_completed?: boolean | null
          instantly_meeting_completed_at?: string | null
          instantly_opens_count?: number | null
          instantly_out_of_office?: boolean | null
          instantly_removed_at?: string | null
          instantly_status?: string | null
          instantly_synced?: boolean | null
          instantly_synced_at?: string | null
          instantly_unsubscribed?: boolean | null
          instantly_unsubscribed_at?: string | null
          instantly_verification_status?: string | null
          instantly_wrong_person?: boolean | null
          is_blocked?: boolean | null
          is_key_contact?: boolean | null
          last_name?: string | null
          last_reply_at?: string | null
          last_touch?: string | null
          linkedin_url?: string | null
          name?: string | null
          phone?: string | null
          pipedrive_person_id?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          qualification_notes?: string | null
          qualification_status?: string
          qualification_timestamp?: string | null
          qualified_by_user?: string | null
          reply_count?: number | null
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
      instantly_email_events: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          email_step: number | null
          email_subject: string | null
          email_variant: string | null
          event_timestamp: string
          event_type: string
          id: string
          lead_email: string
          metadata: Json | null
          pipedrive_activity_id: number | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          synced_to_pipedrive: boolean | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_step?: number | null
          email_subject?: string | null
          email_variant?: string | null
          event_timestamp: string
          event_type: string
          id?: string
          lead_email: string
          metadata?: Json | null
          pipedrive_activity_id?: number | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          synced_to_pipedrive?: boolean | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          email_step?: number | null
          email_subject?: string | null
          email_variant?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          lead_email?: string
          metadata?: Json | null
          pipedrive_activity_id?: number | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          synced_to_pipedrive?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instantly_email_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instantly_email_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instantly_email_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_optimized"
            referencedColumns: ["id"]
          },
        ]
      }
      instantly_pipedrive_syncs: {
        Row: {
          created_at: string | null
          email_activities_count: number | null
          email_activities_error: string | null
          email_activities_retry_count: number | null
          email_activities_synced: boolean | null
          event_type: string
          final_pipedrive_status: string | null
          has_reply: boolean | null
          id: string
          instantly_campaign_id: string
          instantly_campaign_name: string | null
          instantly_event_at: string | null
          instantly_lead_email: string
          instantly_lead_id: string | null
          instantly_workspace_id: string | null
          org_created: boolean | null
          person_created: boolean | null
          pipedrive_org_id: number | null
          pipedrive_org_name: string | null
          pipedrive_person_id: number | null
          previous_status_id: number | null
          raw_webhook_payload: Json | null
          reply_sentiment: string | null
          skip_reason: string | null
          status_prospect_set: string | null
          status_skipped: boolean | null
          status_upgraded: boolean | null
          sync_attempts: number | null
          sync_error: string | null
          sync_source: string
          sync_success: boolean | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_activities_count?: number | null
          email_activities_error?: string | null
          email_activities_retry_count?: number | null
          email_activities_synced?: boolean | null
          event_type: string
          final_pipedrive_status?: string | null
          has_reply?: boolean | null
          id?: string
          instantly_campaign_id: string
          instantly_campaign_name?: string | null
          instantly_event_at?: string | null
          instantly_lead_email: string
          instantly_lead_id?: string | null
          instantly_workspace_id?: string | null
          org_created?: boolean | null
          person_created?: boolean | null
          pipedrive_org_id?: number | null
          pipedrive_org_name?: string | null
          pipedrive_person_id?: number | null
          previous_status_id?: number | null
          raw_webhook_payload?: Json | null
          reply_sentiment?: string | null
          skip_reason?: string | null
          status_prospect_set?: string | null
          status_skipped?: boolean | null
          status_upgraded?: boolean | null
          sync_attempts?: number | null
          sync_error?: string | null
          sync_source?: string
          sync_success?: boolean | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_activities_count?: number | null
          email_activities_error?: string | null
          email_activities_retry_count?: number | null
          email_activities_synced?: boolean | null
          event_type?: string
          final_pipedrive_status?: string | null
          has_reply?: boolean | null
          id?: string
          instantly_campaign_id?: string
          instantly_campaign_name?: string | null
          instantly_event_at?: string | null
          instantly_lead_email?: string
          instantly_lead_id?: string | null
          instantly_workspace_id?: string | null
          org_created?: boolean | null
          person_created?: boolean | null
          pipedrive_org_id?: number | null
          pipedrive_org_name?: string | null
          pipedrive_person_id?: number | null
          previous_status_id?: number | null
          raw_webhook_payload?: Json | null
          reply_sentiment?: string | null
          skip_reason?: string | null
          status_prospect_set?: string | null
          status_skipped?: boolean | null
          status_upgraded?: boolean | null
          sync_attempts?: number | null
          sync_error?: string | null
          sync_source?: string
          sync_success?: boolean | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted: boolean | null
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
          role: string
          token: string
        }
        Update: {
          accepted?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_documents: {
        Row: {
          file_url: string | null
          id: string
          job_posting_id: string | null
          parsed_success: boolean | null
          received_at: string | null
          source_email: string | null
        }
        Insert: {
          file_url?: string | null
          id?: string
          job_posting_id?: string | null
          parsed_success?: boolean | null
          received_at?: string | null
          source_email?: string | null
        }
        Update: {
          file_url?: string | null
          id?: string
          job_posting_id?: string | null
          parsed_success?: boolean | null
          received_at?: string | null
          source_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_documents_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          apify_run_id: string | null
          career_level: string | null
          categories: string | null
          city: string | null
          company_id: string | null
          contact_analysis_completed: boolean
          content_hash: string | null
          country: string | null
          created_at: string | null
          description: string | null
          education_level: string | null
          employment: string | null
          end_date: string | null
          external_vacancy_id: string | null
          id: string
          job_type: string[] | null
          latitude: string | null
          location: string | null
          longitude: string | null
          nominatim_failed: boolean | null
          platform_id: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salary: string | null
          scraped_at: string | null
          search_vector: unknown
          source_id: string | null
          state: string | null
          status: string | null
          street: string | null
          title: string
          url: string | null
          working_hours_max: number | null
          working_hours_min: number | null
          zipcode: string | null
        }
        Insert: {
          apify_run_id?: string | null
          career_level?: string | null
          categories?: string | null
          city?: string | null
          company_id?: string | null
          contact_analysis_completed?: boolean
          content_hash?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          education_level?: string | null
          employment?: string | null
          end_date?: string | null
          external_vacancy_id?: string | null
          id?: string
          job_type?: string[] | null
          latitude?: string | null
          location?: string | null
          longitude?: string | null
          nominatim_failed?: boolean | null
          platform_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          scraped_at?: string | null
          search_vector?: unknown
          source_id?: string | null
          state?: string | null
          status?: string | null
          street?: string | null
          title: string
          url?: string | null
          working_hours_max?: number | null
          working_hours_min?: number | null
          zipcode?: string | null
        }
        Update: {
          apify_run_id?: string | null
          career_level?: string | null
          categories?: string | null
          city?: string | null
          company_id?: string | null
          contact_analysis_completed?: boolean
          content_hash?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          education_level?: string | null
          employment?: string | null
          end_date?: string | null
          external_vacancy_id?: string | null
          id?: string
          job_type?: string[] | null
          latitude?: string | null
          location?: string | null
          longitude?: string | null
          nominatim_failed?: boolean | null
          platform_id?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          scraped_at?: string | null
          search_vector?: unknown
          source_id?: string | null
          state?: string | null
          status?: string | null
          street?: string | null
          title?: string
          url?: string | null
          working_hours_max?: number | null
          working_hours_min?: number | null
          zipcode?: string | null
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
            foreignKeyName: "job_postings_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
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
      job_sources: {
        Row: {
          active: boolean | null
          cost_per_1000_results: number | null
          id: string
          name: string
          scraping_method: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          cost_per_1000_results?: number | null
          id?: string
          name: string
          scraping_method?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          cost_per_1000_results?: number | null
          id?: string
          name?: string
          scraping_method?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      platforms: {
        Row: {
          automation_enabled: boolean | null
          central_place: string
          central_postcode: string | null
          created_at: string | null
          geocoded_at: string | null
          id: string
          instantly_campaign_id: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          regio_platform: string
          scraping_priority: number | null
          updated_at: string | null
        }
        Insert: {
          automation_enabled?: boolean | null
          central_place: string
          central_postcode?: string | null
          created_at?: string | null
          geocoded_at?: string | null
          id?: string
          instantly_campaign_id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          regio_platform: string
          scraping_priority?: number | null
          updated_at?: string | null
        }
        Update: {
          automation_enabled?: boolean | null
          central_place?: string
          central_postcode?: string | null
          created_at?: string | null
          geocoded_at?: string | null
          id?: string
          instantly_campaign_id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          regio_platform?: string
          scraping_priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      scraping_queue: {
        Row: {
          created_at: string
          id: number
          job_data: Json | null
          status: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          job_data?: Json | null
          status?: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          job_data?: Json | null
          status?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          email: string | null
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          name?: string | null
          role?: string | null
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
      cities_with_job_postings_count: {
        Row: {
          created_at: string | null
          id: string | null
          is_active: boolean | null
          job_postings_count: number | null
          plaats: string | null
          platform_id: string | null
          postcode: string | null
          regio_platform: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cities_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cities_platforms"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_statistics: {
        Row: {
          contacts_with_campaign: number | null
          contacts_without_campaign: number | null
          total_contacts: number | null
          unique_companies: number | null
          unique_locations: number | null
          unique_regions: number | null
        }
        Relationships: []
      }
      contact_stats_mv: {
        Row: {
          contacts_with_campaign: number | null
          contacts_without_campaign: number | null
          disqualified_contacts: number | null
          last_updated: string | null
          pending_contacts: number | null
          qualified_contacts: number | null
          review_contacts: number | null
          stat_type: string | null
          total_contacts: number | null
        }
        Relationships: []
      }
      contacts_optimized: {
        Row: {
          apollo_id: string | null
          campaign_id: string | null
          campaign_name: string | null
          category_size: string | null
          company_id: string | null
          company_linkedin: string | null
          company_location: string | null
          company_name: string | null
          company_phone: string | null
          company_status: string | null
          company_status_field: string | null
          created_at: string | null
          email: string | null
          email_status: string | null
          enrichment_status: string | null
          first_name: string | null
          found_at: string | null
          id: string | null
          instantly_id: string | null
          "Klant Status company field": string | null
          last_name: string | null
          last_touch: string | null
          linkedin_url: string | null
          name: string | null
          phone: string | null
          qualification_status: string | null
          qualification_timestamp: string | null
          qualified_by_user: string | null
          region_id: string | null
          size_max: number | null
          size_min: number | null
          source: string | null
          source_id: string | null
          start: string | null
          status: string | null
          status_computed: string | null
          title: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_platform_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "platforms"
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
      job_sources_with_postings: {
        Row: {
          active: boolean | null
          id: string | null
          linked_job_postings: Json | null
          name: string | null
          posting_count: number | null
          scraping_method: string | null
        }
        Relationships: []
      }
      unique_regio_platforms: {
        Row: {
          regio_platform: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      company_status_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          count: number
          status: string
        }[]
      }
      get_contacts_query_performance: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_execution_time: number
          last_execution: string
          query_name: string
          total_executions: number
        }[]
      }
      get_user_session_history: {
        Args: { limit_count?: number; offset_count?: number; user_uuid: string }
        Returns: {
          completed_at: string
          created_at: string
          current_stage: string
          duration_minutes: number
          id: string
          session_id: string
          status: string
          total_campaigns: number
          total_companies: number
          total_contacts: number
          total_jobs: number
        }[]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args: { uri: string } | { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { uri: string } | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args: { content: string; content_type: string; uri: string } | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: { Args: Record<PropertyKey, never>; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      refresh_contact_statistics: { Args: Record<PropertyKey, never>; Returns: undefined }
      refresh_contact_stats_mv: { Args: Record<PropertyKey, never>; Returns: undefined }
      refresh_contacts_materialized_views: { Args: Record<PropertyKey, never>; Returns: undefined }
      refresh_contacts_stats: { Args: Record<PropertyKey, never>; Returns: undefined }
      refresh_unique_regio_platforms: { Args: Record<PropertyKey, never>; Returns: undefined }
      search_contacts: {
        Args: {
          campaign_filter?: string
          page_number?: number
          page_size?: number
          region_filters?: string[]
          search_term?: string
          size_filters?: string[]
          source_filters?: string[]
          status_filters?: string[]
        }
        Returns: {
          campaign_name: string
          company_category_size: string
          company_location: string
          company_name: string
          company_region: string
          company_status: string
          company_status_detail: string
          created_at: string
          email: string
          email_status: string
          first_name: string
          found_at: string
          id: string
          last_name: string
          last_touch: string
          linkedin_url: string
          name: string
          source: string
          title: string
          total_count: number
        }[]
      }
      search_job_postings: {
        Args: {
          career_level_filter?: string[]
          date_from?: string
          date_to?: string
          education_level_filter?: string[]
          employment_filter?: string[]
          hours_max?: number
          hours_min?: number
          page_number?: number
          page_size?: number
          platform_filter?: string[]
          salary_max?: number
          salary_min?: number
          search_term?: string
          source_filter?: string[]
          status_filter?: string
        }
        Returns: {
          career_level: string
          categories: string
          city: string
          company_id: string
          company_is_customer: boolean
          company_logo_url: string
          company_name: string
          company_rating_indeed: number
          company_website: string
          country: string
          created_at: string
          description: string
          education_level: string
          employment: string
          end_date: string
          id: string
          job_type: string[]
          location: string
          platform_id: string
          platform_regio_platform: string
          review_status: string
          salary: string
          scraped_at: string
          source_id: string
          source_name: string
          status: string
          street: string
          title: string
          total_count: number
          url: string
          working_hours_max: number
          working_hours_min: number
          zipcode: string
        }[]
      }
      serialize_workflow_state: {
        Args: { session_uuid: string }
        Returns: Json
      }
      show_limit: { Args: Record<PropertyKey, never>; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      text_to_bytea: { Args: { data: string }; Returns: string }
      upsert_automation_preferences: {
        Args: { p_preferences: Json; p_user_id: string }
        Returns: undefined
      }
      urlencode: { Args: { data: Json }; Returns: string }
    }
    Enums: {
      processing_status_enum: "not_started" | "in_progress" | "completed"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      processing_status_enum: ["not_started", "in_progress", "completed"],
    },
  },
} as const
