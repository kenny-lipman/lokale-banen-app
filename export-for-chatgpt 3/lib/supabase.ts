import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Create a Supabase JS client.
 * We look up the environment variables **only when this function is called**
 * so that Next.js can prerender/compile without having them set during the
 * build step (e.g. on Vercel).
 */
export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
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

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          website: string | null
          location: string | null
          is_customer: boolean | null
          source: string | null
          created_at: string | null
          indeed_url: string | null
          logo_url: string | null
          description: string | null
          review_count_indeed: number | null
          rating_indeed: number | null
          size_min: number | null
          size_max: number | null
          normalized_name: string | null
          status: string | null
          region_id: string | null
          category_size: string | null
        }
        Insert: {
          id?: string
          name: string
          website?: string | null
          location?: string | null
          is_customer?: boolean | null
          source?: string | null
          created_at?: string | null
          indeed_url?: string | null
          logo_url?: string | null
          description?: string | null
          review_count_indeed?: number | null
          rating_indeed?: number | null
          size_min?: number | null
          size_max?: number | null
          normalized_name?: string | null
          status?: string | null
          region_id?: string | null
          category_size?: string | null
        }
        Update: {
          id?: string
          name?: string
          website?: string | null
          location?: string | null
          is_customer?: boolean | null
          source?: string | null
          created_at?: string | null
          indeed_url?: string | null
          logo_url?: string | null
          description?: string | null
          review_count_indeed?: number | null
          rating_indeed?: number | null
          size_min?: number | null
          size_max?: number | null
          normalized_name?: string | null
          status?: string | null
          region_id?: string | null
          category_size?: string | null
        }
      }
      contacts: {
        Row: {
          id: string
          company_id: string | null
          name: string | null
          title: string | null
          email: string | null
          linkedin_url: string | null
          source: string | null
          found_at: string | null
          campaign_name: string | null
          instantly_id: string | null
          created_at: string | null
          first_name: string | null
          last_name: string | null
          last_touch: string | null
          phone: string | null
          campaign_id: string | null
        }
        Insert: {
          id?: string
          company_id?: string | null
          name?: string | null
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          source?: string | null
          found_at?: string | null
          campaign_name?: string | null
          instantly_id?: string | null
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          last_touch?: string | null
          phone?: string | null
          campaign_id?: string | null
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string | null
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          source?: string | null
          found_at?: string | null
          campaign_name?: string | null
          instantly_id?: string | null
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          last_touch?: string | null
          phone?: string | null
          campaign_id?: string | null
        }
      }
      job_postings: {
        Row: {
          id: string
          title: string
          company_id: string | null
          location: string | null
          source_id: string | null
          region_id: string | null
          url: string | null
          description: string | null
          job_type: string | null
          salary: string | null
          scraped_at: string | null
          created_at: string | null
          status: string | null
          review_status: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          content_hash: string | null
          search_vector: string | null
          external_vacancy_id: string | null
          country: string | null
        }
        Insert: {
          id?: string
          title: string
          company_id?: string | null
          location?: string | null
          source_id?: string | null
          region_id?: string | null
          url?: string | null
          description?: string | null
          job_type?: string | null
          salary?: string | null
          scraped_at?: string | null
          created_at?: string | null
          status?: string | null
          review_status?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          content_hash?: string | null
          search_vector?: string | null
          external_vacancy_id?: string | null
          country?: string | null
        }
        Update: {
          id?: string
          title?: string
          company_id?: string | null
          location?: string | null
          source_id?: string | null
          region_id?: string | null
          url?: string | null
          description?: string | null
          job_type?: string | null
          salary?: string | null
          scraped_at?: string | null
          created_at?: string | null
          status?: string | null
          review_status?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          content_hash?: string | null
          search_vector?: string | null
          external_vacancy_id?: string | null
          country?: string | null
        }
      }
      job_sources: {
        Row: {
          id: string
          name: string
          base_url: string | null
          scraping_method: string | null
          active: boolean | null
        }
        Insert: {
          id?: string
          name: string
          base_url?: string | null
          scraping_method?: string | null
          active?: boolean | null
        }
        Update: {
          id?: string
          name?: string
          base_url?: string | null
          scraping_method?: string | null
          active?: boolean | null
        }
      }
      job_documents: {
        Row: {
          id: string
          job_posting_id: string | null
          file_url: string | null
          source_email: string | null
          received_at: string | null
          parsed_success: boolean | null
        }
        Insert: {
          id?: string
          job_posting_id?: string | null
          file_url?: string | null
          source_email?: string | null
          received_at?: string | null
          parsed_success?: boolean | null
        }
        Update: {
          id?: string
          job_posting_id?: string | null
          file_url?: string | null
          source_email?: string | null
          received_at?: string | null
          parsed_success?: boolean | null
        }
      }
      search_requests: {
        Row: {
          id: string
          user_id: string | null
          query: string | null
          status: string | null
          started_at: string | null
          finished_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          query?: string | null
          status?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          query?: string | null
          status?: string | null
          started_at?: string | null
          finished_at?: string | null
        }
      }
      users: {
        Row: {
          id: string
          name: string | null
          email: string | null
          role: string | null
        }
        Insert: {
          id?: string
          name?: string | null
          email?: string | null
          role?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          role?: string | null
        }
      }
      apify_runs: {
        Row: {
          id: string
          status: string | null
          platform: string | null
          functie: string | null
          locatie: string | null
          job_count: number | null
          error: string | null
          created_at: string | null
          finished_at: string | null
        }
        Insert: {
          id?: string
          status?: string | null
          platform?: string | null
          functie?: string | null
          locatie?: string | null
          job_count?: number | null
          error?: string | null
          created_at?: string | null
          finished_at?: string | null
        }
        Update: {
          id?: string
          status?: string | null
          platform?: string | null
          functie?: string | null
          locatie?: string | null
          job_count?: number | null
          error?: string | null
          created_at?: string | null
          finished_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          full_name?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      invitations: {
        Row: {
          id: string
          email: string
          invited_by: string | null
          role: string | null
          token: string
          accepted: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          email: string
          invited_by?: string | null
          role?: string | null
          token: string
          accepted?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          invited_by?: string | null
          role?: string | null
          token?: string
          accepted?: boolean | null
          created_at?: string | null
        }
      }
      regions: {
        Row: {
          id: string
          plaats: string
          postcode: string | null
          regio_platform: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          plaats: string
          postcode?: string | null
          regio_platform?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          plaats?: string
          postcode?: string | null
          regio_platform?: string | null
          created_at?: string | null
        }
      }
    }
  }
}
