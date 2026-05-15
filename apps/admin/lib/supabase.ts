import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

// Singleton instance to prevent multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Create a Supabase client for client-side operations.
 * Uses @supabase/ssr's createBrowserClient so session-tokens worden in cookies
 * geschreven (sb-* format) die de Next middleware en API routes kunnen lezen.
 */
export function createClient() {
  if (supabaseInstance) {
    return supabaseInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Proxy({} as ReturnType<typeof createBrowserClient<Database>>, {
      get() {
        throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)')
      }
    }) as unknown as ReturnType<typeof createBrowserClient<Database>>
  }

  supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
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
    // Return a proxy that throws on first use instead of at import time.
    // This allows Next.js to collect page data during build without env vars.
    return new Proxy({} as ReturnType<typeof createSupabaseClient>, {
      get() {
        throw new Error(
          "Missing Supabase service role environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
      }
    })
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
      automation_runs: {
        Row: {
          automation_id: string
          business_stats: Json | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          http_status: number | null
          id: string
          started_at: string
          status: string
          triggered_by: string
          triggered_by_user_id: string | null
        }
        Insert: {
          automation_id: string
          business_stats?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          started_at: string
          status: string
          triggered_by?: string
          triggered_by_user_id?: string | null
        }
        Update: {
          automation_id?: string
          business_stats?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          started_at?: string
          status?: string
          triggered_by?: string
          triggered_by_user_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "blocklist_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocklist_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
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
      campaign_assignment_batches: {
        Row: {
          added: number | null
          batch_id: string
          candidate_ids: string[] | null
          completed_at: string | null
          created_at: string | null
          errors: number | null
          id: string
          last_error: string | null
          orchestration_id: string | null
          platform_stats: Json | null
          processed: number | null
          processed_ids: string[] | null
          skipped: number | null
          started_at: string | null
          status: string
          total_candidates: number | null
          updated_at: string | null
        }
        Insert: {
          added?: number | null
          batch_id: string
          candidate_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          errors?: number | null
          id?: string
          last_error?: string | null
          orchestration_id?: string | null
          platform_stats?: Json | null
          processed?: number | null
          processed_ids?: string[] | null
          skipped?: number | null
          started_at?: string | null
          status?: string
          total_candidates?: number | null
          updated_at?: string | null
        }
        Update: {
          added?: number | null
          batch_id?: string
          candidate_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          errors?: number | null
          id?: string
          last_error?: string | null
          orchestration_id?: string | null
          platform_stats?: Json | null
          processed?: number | null
          processed_ids?: string[] | null
          skipped?: number | null
          started_at?: string | null
          status?: string
          total_candidates?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_assignment_logs: {
        Row: {
          ai_personalization: Json | null
          ai_processing_time_ms: number | null
          batch_id: string
          company_id: string | null
          company_name: string | null
          contact_email: string
          contact_id: string
          contact_name: string | null
          created_at: string | null
          error_message: string | null
          id: string
          instantly_campaign_id: string | null
          instantly_lead_id: string | null
          instantly_response: Json | null
          pipedrive_is_klant: boolean | null
          pipedrive_org_id: number | null
          pipedrive_status_checked: boolean | null
          platform_id: string | null
          platform_name: string | null
          skip_reason: string | null
          status: string
        }
        Insert: {
          ai_personalization?: Json | null
          ai_processing_time_ms?: number | null
          batch_id: string
          company_id?: string | null
          company_name?: string | null
          contact_email: string
          contact_id: string
          contact_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instantly_campaign_id?: string | null
          instantly_lead_id?: string | null
          instantly_response?: Json | null
          pipedrive_is_klant?: boolean | null
          pipedrive_org_id?: number | null
          pipedrive_status_checked?: boolean | null
          platform_id?: string | null
          platform_name?: string | null
          skip_reason?: string | null
          status: string
        }
        Update: {
          ai_personalization?: Json | null
          ai_processing_time_ms?: number | null
          batch_id?: string
          company_id?: string | null
          company_name?: string | null
          contact_email?: string
          contact_id?: string
          contact_name?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          instantly_campaign_id?: string | null
          instantly_lead_id?: string | null
          instantly_response?: Json | null
          pipedrive_is_klant?: boolean | null
          pipedrive_org_id?: number | null
          pipedrive_status_checked?: boolean | null
          platform_id?: string | null
          platform_name?: string | null
          skip_reason?: string | null
          status?: string
        }
        Relationships: []
      }
      campaign_assignment_settings: {
        Row: {
          delay_between_contacts_ms: number
          id: string
          is_enabled: boolean
          max_per_platform: number
          max_total_contacts: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          delay_between_contacts_ms?: number
          id?: string
          is_enabled?: boolean
          max_per_platform?: number
          max_total_contacts?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          delay_between_contacts_ms?: number
          id?: string
          is_enabled?: boolean
          max_per_platform?: number
          max_total_contacts?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          hoofddomein: string | null
          hoofddomein_updated_at: string | null
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
          logo_fetched_at: string | null
          logo_source: string | null
          logo_url: string | null
          lokalebanen_id: string | null
          lokalebanen_pushed_at: string | null
          longitude: number | null
          name: string
          nominatim_success: boolean | null
          normalized_name: string | null
          phone: string | null
          pipedrive_id: string | null
          pipedrive_synced: boolean | null
          pipedrive_synced_at: string | null
          postal_code: string | null
          postcode_geocode_source: string | null
          postcode_geocoded_at: string | null
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
          slug: string | null
          source: string | null
          "SourceId (CRM)": string | null
          start: string | null
          state: string | null
          status: string | null
          street_address: string | null
          subdomeinen: string[] | null
          verified: boolean | null
          website: string | null
          werkenindekempen_id: string | null
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
          hoofddomein?: string | null
          hoofddomein_updated_at?: string | null
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
          logo_fetched_at?: string | null
          logo_source?: string | null
          logo_url?: string | null
          lokalebanen_id?: string | null
          lokalebanen_pushed_at?: string | null
          longitude?: number | null
          name: string
          nominatim_success?: boolean | null
          normalized_name?: string | null
          phone?: string | null
          pipedrive_id?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          postal_code?: string | null
          postcode_geocode_source?: string | null
          postcode_geocoded_at?: string | null
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
          slug?: string | null
          source?: string | null
          "SourceId (CRM)"?: string | null
          start?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          subdomeinen?: string[] | null
          verified?: boolean | null
          website?: string | null
          werkenindekempen_id?: string | null
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
          hoofddomein?: string | null
          hoofddomein_updated_at?: string | null
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
          logo_fetched_at?: string | null
          logo_source?: string | null
          logo_url?: string | null
          lokalebanen_id?: string | null
          lokalebanen_pushed_at?: string | null
          longitude?: number | null
          name?: string
          nominatim_success?: boolean | null
          normalized_name?: string | null
          phone?: string | null
          pipedrive_id?: string | null
          pipedrive_synced?: boolean | null
          pipedrive_synced_at?: string | null
          postal_code?: string | null
          postcode_geocode_source?: string | null
          postcode_geocoded_at?: string | null
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
          slug?: string | null
          source?: string | null
          "SourceId (CRM)"?: string | null
          start?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          subdomeinen?: string[] | null
          verified?: boolean | null
          website?: string | null
          werkenindekempen_id?: string | null
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
          instantly_campaign_completed_at: string | null
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
          pipedrive_sync_attempts: number
          pipedrive_sync_failed_at: string | null
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
          instantly_campaign_completed_at?: string | null
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
          pipedrive_sync_attempts?: number
          pipedrive_sync_failed_at?: string | null
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
          instantly_campaign_completed_at?: string | null
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
          pipedrive_sync_attempts?: number
          pipedrive_sync_failed_at?: string | null
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
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
          },
        ]
      }
      cron_job_logs: {
        Row: {
          completed_at: string
          created_at: string
          duration_ms: number
          error_message: string | null
          http_status: number | null
          id: string
          job_name: string
          path: string
          response_summary: Json | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          duration_ms: number
          error_message?: string | null
          http_status?: number | null
          id?: string
          job_name: string
          path: string
          response_summary?: Json | null
          started_at: string
          status: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          http_status?: number | null
          id?: string
          job_name?: string
          path?: string
          response_summary?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      cron_watchdog_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          job_name: string
          message: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          job_name: string
          message: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          job_name?: string
          message?: string
        }
        Relationships: []
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
      enrichment_cache: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          response: Json
          source: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          fetched_at?: string
          response: Json
          source: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          response?: Json
          source?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "enrichment_status_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_status_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
          },
        ]
      }
      instantly_backfill_activity_logs: {
        Row: {
          batch_id: string | null
          created_at: string | null
          id: string
          log_type: string
          message: string
          metadata: Json | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          id?: string
          log_type: string
          message: string
          metadata?: Json | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          id?: string
          log_type?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "instantly_backfill_activity_logs_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "instantly_backfill_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      instantly_backfill_batches: {
        Row: {
          batch_id: string
          batch_size: number | null
          campaign_ids: string[] | null
          completed_at: string | null
          created_at: string | null
          current_batch: number | null
          current_campaign_index: number | null
          current_campaign_name: string | null
          delay_ms: number | null
          dry_run: boolean | null
          error_count: number | null
          failed_leads: number | null
          id: string
          last_error: string | null
          max_leads_to_collect: number | null
          paused_at: string | null
          processed_leads: number | null
          skipped_leads: number | null
          started_at: string | null
          status: string | null
          synced_leads: number | null
          total_campaigns: number | null
          total_leads: number | null
          updated_at: string | null
        }
        Insert: {
          batch_id: string
          batch_size?: number | null
          campaign_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          current_campaign_index?: number | null
          current_campaign_name?: string | null
          delay_ms?: number | null
          dry_run?: boolean | null
          error_count?: number | null
          failed_leads?: number | null
          id?: string
          last_error?: string | null
          max_leads_to_collect?: number | null
          paused_at?: string | null
          processed_leads?: number | null
          skipped_leads?: number | null
          started_at?: string | null
          status?: string | null
          synced_leads?: number | null
          total_campaigns?: number | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          batch_id?: string
          batch_size?: number | null
          campaign_ids?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          current_batch?: number | null
          current_campaign_index?: number | null
          current_campaign_name?: string | null
          delay_ms?: number | null
          dry_run?: boolean | null
          error_count?: number | null
          failed_leads?: number | null
          id?: string
          last_error?: string | null
          max_leads_to_collect?: number | null
          paused_at?: string | null
          processed_leads?: number | null
          skipped_leads?: number | null
          started_at?: string | null
          status?: string | null
          synced_leads?: number | null
          total_campaigns?: number | null
          total_leads?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instantly_backfill_leads: {
        Row: {
          batch_id: string | null
          campaign_id: string
          campaign_name: string | null
          collected_at: string | null
          completed_at: string | null
          determined_event_type: string | null
          error_message: string | null
          has_reply: boolean | null
          id: string
          instantly_data: Json | null
          lead_email: string
          pipedrive_org_id: number | null
          pipedrive_person_id: number | null
          retry_count: number | null
          status: string | null
        }
        Insert: {
          batch_id?: string | null
          campaign_id: string
          campaign_name?: string | null
          collected_at?: string | null
          completed_at?: string | null
          determined_event_type?: string | null
          error_message?: string | null
          has_reply?: boolean | null
          id?: string
          instantly_data?: Json | null
          lead_email: string
          pipedrive_org_id?: number | null
          pipedrive_person_id?: number | null
          retry_count?: number | null
          status?: string | null
        }
        Update: {
          batch_id?: string | null
          campaign_id?: string
          campaign_name?: string | null
          collected_at?: string | null
          completed_at?: string | null
          determined_event_type?: string | null
          error_message?: string | null
          has_reply?: boolean | null
          id?: string
          instantly_data?: Json | null
          lead_email?: string
          pipedrive_org_id?: number | null
          pipedrive_person_id?: number | null
          retry_count?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instantly_backfill_leads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "instantly_backfill_batches"
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
            foreignKeyName: "instantly_email_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instantly_email_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
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
      job_applications: {
        Row: {
          applied_at: string | null
          id: string
          job_posting_id: string
          metadata: Json | null
          method: string | null
          organization_id: string | null
          platform_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          id?: string
          job_posting_id: string
          metadata?: Json | null
          method?: string | null
          organization_id?: string | null
          platform_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          id?: string
          job_posting_id?: string
          metadata?: Json | null
          method?: string | null
          organization_id?: string | null
          platform_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
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
      job_posting_platforms: {
        Row: {
          created_at: string | null
          distance_km: number | null
          is_primary: boolean
          job_posting_id: string
          platform_id: string
        }
        Insert: {
          created_at?: string | null
          distance_km?: number | null
          is_primary?: boolean
          job_posting_id: string
          platform_id: string
        }
        Update: {
          created_at?: string | null
          distance_km?: number | null
          is_primary?: boolean
          job_posting_id?: string
          platform_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posting_platforms_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_posting_platforms_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      job_postings: {
        Row: {
          apify_run_id: string | null
          archived_at: string | null
          archived_by: string | null
          archived_reason: string | null
          career_level: string | null
          categories: string | null
          city: string | null
          company_id: string | null
          contact_analysis_completed: boolean
          content_enriched_at: string | null
          content_hash: string | null
          content_md: string | null
          country: string | null
          created_at: string | null
          description: string | null
          education_level: string | null
          employment: string | null
          end_date: string | null
          external_vacancy_id: string | null
          geocoded_via: string | null
          geocoding_failed: boolean | null
          geocoding_failed_reason: string | null
          geog: unknown
          geog_invalid: boolean | null
          header_image_url: string | null
          id: string
          job_type: string[] | null
          last_seen_in_sitemap: string | null
          latitude: string | null
          location: string | null
          lokalebanen_id: string | null
          lokalebanen_pushed_at: string | null
          longitude: string | null
          platform_id: string | null
          published_at: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          salary: string | null
          scraped_at: string | null
          search_vector: unknown
          seo_description: string | null
          seo_title: string | null
          slug: string | null
          source_id: string | null
          state: string | null
          status: string | null
          street: string | null
          title: string
          updated_at: string
          url: string | null
          working_hours_max: number | null
          working_hours_min: number | null
          zipcode: string | null
        }
        Insert: {
          apify_run_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          career_level?: string | null
          categories?: string | null
          city?: string | null
          company_id?: string | null
          contact_analysis_completed?: boolean
          content_enriched_at?: string | null
          content_hash?: string | null
          content_md?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          education_level?: string | null
          employment?: string | null
          end_date?: string | null
          external_vacancy_id?: string | null
          geocoded_via?: string | null
          geocoding_failed?: boolean | null
          geocoding_failed_reason?: string | null
          geog?: unknown
          geog_invalid?: boolean | null
          header_image_url?: string | null
          id?: string
          job_type?: string[] | null
          last_seen_in_sitemap?: string | null
          latitude?: string | null
          location?: string | null
          lokalebanen_id?: string | null
          lokalebanen_pushed_at?: string | null
          longitude?: string | null
          platform_id?: string | null
          published_at?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          scraped_at?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          source_id?: string | null
          state?: string | null
          status?: string | null
          street?: string | null
          title: string
          updated_at?: string
          url?: string | null
          working_hours_max?: number | null
          working_hours_min?: number | null
          zipcode?: string | null
        }
        Update: {
          apify_run_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archived_reason?: string | null
          career_level?: string | null
          categories?: string | null
          city?: string | null
          company_id?: string | null
          contact_analysis_completed?: boolean
          content_enriched_at?: string | null
          content_hash?: string | null
          content_md?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          education_level?: string | null
          employment?: string | null
          end_date?: string | null
          external_vacancy_id?: string | null
          geocoded_via?: string | null
          geocoding_failed?: boolean | null
          geocoding_failed_reason?: string | null
          geog?: unknown
          geog_invalid?: boolean | null
          header_image_url?: string | null
          id?: string
          job_type?: string[] | null
          last_seen_in_sitemap?: string | null
          latitude?: string | null
          location?: string | null
          lokalebanen_id?: string | null
          lokalebanen_pushed_at?: string | null
          longitude?: string | null
          platform_id?: string | null
          published_at?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          salary?: string | null
          scraped_at?: string | null
          search_vector?: unknown
          seo_description?: string | null
          seo_title?: string | null
          slug?: string | null
          source_id?: string | null
          state?: string | null
          status?: string | null
          street?: string | null
          title?: string
          updated_at?: string
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
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_postings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
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
          approved_at: string | null
          approved_by: string | null
          ats_type: string | null
          company_id: string | null
          consecutive_failures: number
          cost_per_1000_results: number | null
          created_at: string
          created_via: string | null
          discovery_method: string | null
          id: string
          is_external_ats: boolean | null
          kind: string
          last_scrape_count: number | null
          last_scrape_status: string | null
          last_scraped_at: string | null
          name: string
          next_scrape_at: string
          rejected_at: string | null
          rejected_by: string | null
          rejected_reason: string | null
          review_status: string
          scrape_frequency: string | null
          scraping_method: string | null
          source_run_id: string | null
          updated_at: string
          url: string | null
          webhook_url: string | null
        }
        Insert: {
          active?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          ats_type?: string | null
          company_id?: string | null
          consecutive_failures?: number
          cost_per_1000_results?: number | null
          created_at?: string
          created_via?: string | null
          discovery_method?: string | null
          id?: string
          is_external_ats?: boolean | null
          kind?: string
          last_scrape_count?: number | null
          last_scrape_status?: string | null
          last_scraped_at?: string | null
          name: string
          next_scrape_at?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          review_status?: string
          scrape_frequency?: string | null
          scraping_method?: string | null
          source_run_id?: string | null
          updated_at?: string
          url?: string | null
          webhook_url?: string | null
        }
        Update: {
          active?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          ats_type?: string | null
          company_id?: string | null
          consecutive_failures?: number
          cost_per_1000_results?: number | null
          created_at?: string
          created_via?: string | null
          discovery_method?: string | null
          id?: string
          is_external_ats?: boolean | null
          kind?: string
          last_scrape_count?: number | null
          last_scrape_status?: string | null
          last_scraped_at?: string | null
          name?: string
          next_scrape_at?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejected_reason?: string | null
          review_status?: string
          scrape_frequency?: string | null
          scraping_method?: string | null
          source_run_id?: string | null
          updated_at?: string
          url?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "job_sources_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "sales_lead_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      lokalebanen_mappings: {
        Row: {
          created_at: string | null
          id: string
          our_value: string
          their_value: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          our_value: string
          their_value?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          our_value?: string
          their_value?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mailerlite_syncs: {
        Row: {
          created_at: string | null
          email: string
          hoofddomein: string | null
          id: string
          mailerlite_group_id: string | null
          mailerlite_group_name: string | null
          mailerlite_subscriber_id: string | null
          pipedrive_org_id: number | null
          pipedrive_person_id: number | null
          sync_error: string | null
          sync_source: string
          sync_success: boolean | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          hoofddomein?: string | null
          id?: string
          mailerlite_group_id?: string | null
          mailerlite_group_name?: string | null
          mailerlite_subscriber_id?: string | null
          pipedrive_org_id?: number | null
          pipedrive_person_id?: number | null
          sync_error?: string | null
          sync_source?: string
          sync_success?: boolean | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          hoofddomein?: string | null
          id?: string
          mailerlite_group_id?: string | null
          mailerlite_group_name?: string | null
          mailerlite_subscriber_id?: string | null
          pipedrive_org_id?: number | null
          pipedrive_person_id?: number | null
          sync_error?: string | null
          sync_source?: string
          sync_success?: boolean | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          requested_ip: string | null
          token_hash: string
          used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          requested_ip?: string | null
          token_hash: string
          used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          requested_ip?: string | null
          token_hash?: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pipedrive_config: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      platforms: {
        Row: {
          about_text: string | null
          automation_enabled: boolean | null
          central_place: string
          central_postcode: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          domain: string | null
          favicon_url: string | null
          geocoded_at: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          indexnow_key: string | null
          instantly_campaign_id: string | null
          is_active: boolean | null
          is_public: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          mailerlite_group_id: string | null
          og_image_url: string | null
          preview_domain: string | null
          primary_color: string | null
          privacy_text: string | null
          published_at: string | null
          regio_platform: string
          scraping_priority: number | null
          secondary_color: string | null
          seo_description: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          terms_text: string | null
          tertiary_color: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          about_text?: string | null
          automation_enabled?: boolean | null
          central_place: string
          central_postcode?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          domain?: string | null
          favicon_url?: string | null
          geocoded_at?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          indexnow_key?: string | null
          instantly_campaign_id?: string | null
          is_active?: boolean | null
          is_public?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          mailerlite_group_id?: string | null
          og_image_url?: string | null
          preview_domain?: string | null
          primary_color?: string | null
          privacy_text?: string | null
          published_at?: string | null
          regio_platform: string
          scraping_priority?: number | null
          secondary_color?: string | null
          seo_description?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          terms_text?: string | null
          tertiary_color?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          about_text?: string | null
          automation_enabled?: boolean | null
          central_place?: string
          central_postcode?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          domain?: string | null
          favicon_url?: string | null
          geocoded_at?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          indexnow_key?: string | null
          instantly_campaign_id?: string | null
          is_active?: boolean | null
          is_public?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          mailerlite_group_id?: string | null
          og_image_url?: string | null
          preview_domain?: string | null
          primary_color?: string | null
          privacy_text?: string | null
          published_at?: string | null
          regio_platform?: string
          scraping_priority?: number | null
          secondary_color?: string | null
          seo_description?: string | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          terms_text?: string | null
          tertiary_color?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      postcode_geocode_queue: {
        Row: {
          company_id: string
          created_at: string | null
          processed_at: string | null
          request_id: number | null
          search_query: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          processed_at?: string | null
          request_id?: number | null
          search_query?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          processed_at?: string | null
          request_id?: number | null
          search_query?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postcode_geocode_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postcode_geocode_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postcode_geocode_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
          },
        ]
      }
      postcode_platform_lookup: {
        Row: {
          created_at: string | null
          distance: number
          postcode: string
          regio_platform: string
          source_postcode: string | null
        }
        Insert: {
          created_at?: string | null
          distance?: number
          postcode: string
          regio_platform: string
          source_postcode?: string | null
        }
        Update: {
          created_at?: string | null
          distance?: number
          postcode?: string
          regio_platform?: string
          source_postcode?: string | null
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
      sales_lead_owner_config: {
        Row: {
          contactmoment_field_key: string | null
          contactmoment_offset_workdays: number
          created_at: string
          display_order: number
          hoofddomein_fixed_value: string | null
          hoofddomein_strategy: string
          id: string
          is_active: boolean
          key: string
          label: string
          pipedrive_default_stage_id: number
          pipedrive_pipeline_id: number
          pipedrive_user_id: number
          updated_at: string
          wetarget_flag_value: number
        }
        Insert: {
          contactmoment_field_key?: string | null
          contactmoment_offset_workdays?: number
          created_at?: string
          display_order?: number
          hoofddomein_fixed_value?: string | null
          hoofddomein_strategy: string
          id?: string
          is_active?: boolean
          key: string
          label: string
          pipedrive_default_stage_id: number
          pipedrive_pipeline_id: number
          pipedrive_user_id: number
          updated_at?: string
          wetarget_flag_value?: number
        }
        Update: {
          contactmoment_field_key?: string | null
          contactmoment_offset_workdays?: number
          created_at?: string
          display_order?: number
          hoofddomein_fixed_value?: string | null
          hoofddomein_strategy?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          pipedrive_default_stage_id?: number
          pipedrive_pipeline_id?: number
          pipedrive_user_id?: number
          updated_at?: string
          wetarget_flag_value?: number
        }
        Relationships: []
      }
      sales_lead_runs: {
        Row: {
          audit_log: Json
          created_at: string
          created_by: string | null
          enrichments: Json
          error: string | null
          existing_pipedrive_org_id: number | null
          id: string
          input_domain: string
          input_url: string
          manual_vacancies: Json
          master_record: Json | null
          owner_config_id: string
          pipedrive_deal_id: number | null
          pipedrive_org_id: number | null
          pipedrive_person_ids: number[]
          scrape_vacancies: boolean
          selected_contacts: Json
          status: string
          updated_at: string
        }
        Insert: {
          audit_log?: Json
          created_at?: string
          created_by?: string | null
          enrichments?: Json
          error?: string | null
          existing_pipedrive_org_id?: number | null
          id?: string
          input_domain: string
          input_url: string
          manual_vacancies?: Json
          master_record?: Json | null
          owner_config_id: string
          pipedrive_deal_id?: number | null
          pipedrive_org_id?: number | null
          pipedrive_person_ids?: number[]
          scrape_vacancies?: boolean
          selected_contacts?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          audit_log?: Json
          created_at?: string
          created_by?: string | null
          enrichments?: Json
          error?: string | null
          existing_pipedrive_org_id?: number | null
          id?: string
          input_domain?: string
          input_url?: string
          manual_vacancies?: Json
          master_record?: Json | null
          owner_config_id?: string
          pipedrive_deal_id?: number | null
          pipedrive_org_id?: number | null
          pipedrive_person_ids?: number[]
          scrape_vacancies?: boolean
          selected_contacts?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_lead_runs_owner_config_id_fkey"
            columns: ["owner_config_id"]
            isOneToOne: false
            referencedRelation: "sales_lead_owner_config"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          job_posting_id: string
          notes: string | null
          platform_id: string | null
          saved_at: string | null
          user_id: string
        }
        Insert: {
          job_posting_id: string
          notes?: string | null
          platform_id?: string | null
          saved_at?: string | null
          user_id: string
        }
        Update: {
          job_posting_id?: string
          notes?: string | null
          platform_id?: string | null
          saved_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_backfill_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_page: number | null
          id: string
          last_run_at: string | null
          pages_per_run: number | null
          runs_completed: number | null
          scraper_name: string
          skip_ai: boolean | null
          started_at: string | null
          status: string | null
          total_errors: number | null
          total_inserted: number | null
          total_pages: number
          total_skipped: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_page?: number | null
          id?: string
          last_run_at?: string | null
          pages_per_run?: number | null
          runs_completed?: number | null
          scraper_name: string
          skip_ai?: boolean | null
          started_at?: string | null
          status?: string | null
          total_errors?: number | null
          total_inserted?: number | null
          total_pages: number
          total_skipped?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_page?: number | null
          id?: string
          last_run_at?: string | null
          pages_per_run?: number | null
          runs_completed?: number | null
          scraper_name?: string
          skip_ai?: boolean | null
          started_at?: string | null
          status?: string | null
          total_errors?: number | null
          total_inserted?: number | null
          total_pages?: number
          total_skipped?: number | null
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
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          phone: string | null
          platform_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          phone?: string | null
          platform_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          phone?: string | null
          platform_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
        ]
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
      wetarget_leads_staging: {
        Row: {
          city: string | null
          company_id: string
          company_name: string | null
          contact_id: string
          created_at: string | null
          email: string
          first_name: string | null
          id: number
          instantly_campaign_id: string | null
          job_created_at: string | null
          job_title: string | null
          last_name: string | null
          postal_code: string | null
          pushed_to_instantly: boolean | null
          sector: string
          state: string | null
        }
        Insert: {
          city?: string | null
          company_id: string
          company_name?: string | null
          contact_id: string
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: number
          instantly_campaign_id?: string | null
          job_created_at?: string | null
          job_title?: string | null
          last_name?: string | null
          postal_code?: string | null
          pushed_to_instantly?: boolean | null
          sector: string
          state?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string
          company_name?: string | null
          contact_id?: string
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: number
          instantly_campaign_id?: string | null
          job_created_at?: string | null
          job_title?: string | null
          last_name?: string | null
          postal_code?: string | null
          pushed_to_instantly?: boolean | null
          sector?: string
          state?: string | null
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
      company_display_info: {
        Row: {
          id: string | null
          industry_label: string | null
          is_customer: boolean | null
          location: string | null
          logo_source: string | null
          logo_url: string | null
          name: string | null
          pipedrive_synced: boolean | null
          size_label: string | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          id?: string | null
          industry_label?: never
          is_customer?: boolean | null
          location?: string | null
          logo_source?: string | null
          logo_url?: string | null
          name?: string | null
          pipedrive_synced?: boolean | null
          size_label?: never
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          id?: string | null
          industry_label?: never
          is_customer?: boolean | null
          location?: string | null
          logo_source?: string | null
          logo_url?: string | null
          name?: string | null
          pipedrive_synced?: boolean | null
          size_label?: never
          verified?: boolean | null
          website?: string | null
        }
        Relationships: []
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
          hoofddomein: string | null
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
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_display_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "mv_campaign_eligible_companies"
            referencedColumns: ["company_id"]
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
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
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
      mv_campaign_eligible_companies: {
        Row: {
          category_size: string | null
          company_description: string | null
          company_id: string | null
          company_location: string | null
          company_name: string | null
          company_website: string | null
          industries: string[] | null
          pipedrive_id: string | null
        }
        Relationships: []
      }
      mv_company_platforms: {
        Row: {
          company_id: string | null
          last_posted_at: string | null
          platform_id: string | null
          posting_count: number | null
          source: string | null
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
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      append_processed_id: {
        Args: { p_batch_id: string; p_contact_id: string }
        Returns: undefined
      }
      auto_archive_old_postings: {
        Args: { age_days?: number; batch_size?: number }
        Returns: number
      }
      backfill_job_geog_batch: {
        Args: { batch_size?: number }
        Returns: {
          filled: number
          processed: number
          skipped: number
        }[]
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
      company_status_counts: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      exec_sql: { Args: { query: string }; Returns: Json }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_automation_run_stats: {
        Args: { filter_automation_id?: string; since_date: string }
        Returns: {
          automation_id: string
          avg_duration_ms: number
          error_count: number
          max_duration_ms: number
          success_count: number
          timeout_count: number
          total_runs: number
        }[]
      }
      get_campaign_assignment_candidates: {
        Args: { p_max_per_platform?: number; p_max_total?: number }
        Returns: {
          company_category_size: string
          company_description: string
          company_id: string
          company_industries: string[]
          company_location: string
          company_name: string
          company_pipedrive_id: string
          company_website: string
          email: string
          first_name: string
          id: string
          instantly_campaign_id: string
          job_posting_location: string
          job_posting_title: string
          last_name: string
          linkedin_url: string
          phone: string
          platform_id: string
          platform_name: string
          title: string
        }[]
      }
      get_city_job_counts: {
        Args: { p_platform_id: string }
        Returns: {
          city: string
          count: number
        }[]
      }
      get_company_counts: {
        Args: {
          apollo_enriched_filter?: string
          category_size_filter?: string[]
          date_from?: string
          date_to?: string
          instantly_filter?: string
          is_customer_filter?: boolean
          pipedrive_filter?: string
          regio_platform_filter?: string[]
          search_term?: string
          source_filter?: string
          status_filter?: string
          subdomeinen_filter?: string[]
          website_filter?: string
        }
        Returns: {
          is_capped: boolean
          qualification_status: string
          row_count: number
        }[]
      }
      get_contact_count: {
        Args: {
          category_status?: string[]
          company_size?: string[]
          company_start?: string[]
          company_status?: string[]
          date_from?: string
          date_to?: string
          has_email?: string
          in_campaign?: string
          instantly_filter?: string
          pipedrive_filter?: string
          platform_company_ids?: string[]
          search_term?: string
        }
        Returns: {
          is_capped: boolean
          row_count: number
        }[]
      }
      get_contacts_query_performance: {
        Args: never
        Returns: {
          avg_execution_time: number
          last_execution: string
          query_name: string
          total_executions: number
        }[]
      }
      get_cron_job_stats: {
        Args: { filter_job_name?: string; since_date: string }
        Returns: {
          avg_duration_ms: number
          error_count: number
          job_name: string
          max_duration_ms: number
          success_count: number
          timeout_count: number
          total_runs: number
        }[]
      }
      get_job_filter_facets: {
        Args: { p_platform_id: string }
        Returns: {
          facet_count: number
          facet_group: string
          facet_value: string
        }[]
      }
      get_job_posting_counts: {
        Args: { count_cap?: number; platform_filter?: string }
        Returns: {
          is_estimate: boolean
          row_count: number
          status_bucket: string
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
      gettransactionid: { Args: never; Returns: unknown }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      increment_backfill_batch_counter: {
        Args: { p_batch_id: string; p_counter_name: string }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      process_postcode_geocode_responses: {
        Args: never
        Returns: {
          out_city: string
          out_company_id: string
          out_pipedrive_updated: boolean
          out_postcode: string
          out_status: string
        }[]
      }
      publish_platform_atomic: {
        Args: { p_id: string }
        Returns: {
          about_text: string | null
          automation_enabled: boolean | null
          central_place: string
          central_postcode: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          domain: string | null
          favicon_url: string | null
          geocoded_at: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          indexnow_key: string | null
          instantly_campaign_id: string | null
          is_active: boolean | null
          is_public: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          mailerlite_group_id: string | null
          og_image_url: string | null
          preview_domain: string | null
          primary_color: string | null
          privacy_text: string | null
          published_at: string | null
          regio_platform: string
          scraping_priority: number | null
          secondary_color: string | null
          seo_description: string | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          social_tiktok: string | null
          social_twitter: string | null
          terms_text: string | null
          tertiary_color: string | null
          tier: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "platforms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      queue_postcode_geocode_requests: {
        Args: { batch_size?: number }
        Returns: {
          out_company_id: string
          out_company_name: string
          out_request_id: number
          out_search_query: string
        }[]
      }
      refresh_campaign_eligible_companies: { Args: never; Returns: undefined }
      refresh_company_platforms_mv: { Args: never; Returns: undefined }
      refresh_contact_statistics: { Args: never; Returns: undefined }
      refresh_contact_stats_mv: { Args: never; Returns: undefined }
      refresh_contacts_materialized_views: { Args: never; Returns: undefined }
      refresh_contacts_stats: { Args: never; Returns: undefined }
      refresh_unique_regio_platforms: { Args: never; Returns: undefined }
      run_postcode_backfill_cycle: {
        Args: { batch_size?: number }
        Returns: {
          phase: string
          pipedrive_updated: number
          processed: number
          successful: number
        }[]
      }
      sales_lead_runs_append_audit: {
        Args: { p_entry: Json; p_run_id: string }
        Returns: undefined
      }
      sales_lead_runs_set_source: {
        Args: { p_run_id: string; p_source: string; p_value: Json }
        Returns: undefined
      }
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
          archived_filter?: string
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
          review_status_filter?: string
          salary_max?: number
          salary_min?: number
          search_term?: string
          source_filter?: string[]
          status_filter?: string
        }
        Returns: {
          archived_at: string
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
          is_capped: boolean
          job_type: string[]
          location: string
          lokalebanen_pushed_at: string
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_pipedrive_organization_domeinen: {
        Args: {
          p_company_id: string
          p_pipedrive_id: string
          p_postal_code: string
        }
        Returns: Json
      }
      update_pipedrive_organization_full: {
        Args: {
          p_company_id: string
          p_pipedrive_id: string
          p_postal_code: string
        }
        Returns: Json
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_automation_preferences: {
        Args: { p_preferences: Json; p_user_id: string }
        Returns: undefined
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      processing_status_enum: "not_started" | "in_progress" | "completed"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
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
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
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
