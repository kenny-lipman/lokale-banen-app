import { createClient } from "./supabase"
import type { Database } from "./supabase"

type JobPosting = Database["public"]["Tables"]["job_postings"]["Row"]
type Company = Database["public"]["Tables"]["companies"]["Row"]
type JobSource = Database["public"]["Tables"]["job_sources"]["Row"]
type SearchRequest = Database["public"]["Tables"]["search_requests"]["Row"]

export class SupabaseService {
  /** Lazily created Supabase client */
  private supabase: ReturnType<typeof createClient> | null = null

  private get client() {
    if (!this.supabase) {
      this.supabase = createClient()
    }
    return this.supabase
  }

  // Test connection
  async testConnection() {
    try {
      const { data, error } = await this.client.from("job_postings").select("count", { count: "exact", head: true })

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

  // Get job postings with pagination and search
  async getJobPostings(
    options: {
      page?: number
      limit?: number
      search?: string
      status?: string
      review_status?: string
    } = {},
  ) {
    const { page = 1, limit = 10, search = "", status, review_status } = options

    try {
      let query = this.client.from("job_postings").select(
        `
          id,
          title,
          location,
          status,
          review_status,
          scraped_at,
          created_at,
          company_id,
          job_type,
          salary,
          url,
          country,
          companies!inner(name, website, logo_url, rating_indeed, is_customer),
          job_sources!inner(name)
        `,
        { count: "exact" },
      )

      // Add search filter using tsvector if available
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,location.ilike.%${search}%,companies.name.ilike.%${search}%,job_type.ilike.%${search}%`,
        )
      }

      // Add status filters
      if (status) {
        query = query.eq("status", status)
      }

      if (review_status) {
        query = query.eq("review_status", review_status)
      }

      // Add pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      // Order by created_at descending (or scraped_at if available)
      query = query.order("created_at", { ascending: false })

      const { data, error, count } = await query

      if (error) {
        throw error
      }

      // Transform data
      const transformedData =
        data?.map((job: any) => ({
          id: job.id,
          title: job.title,
          company_name: job.companies.name,
          company_logo: job.companies.logo_url,
          company_rating: job.companies.rating_indeed,
          is_customer: job.companies.is_customer,
          location: job.location,
          platform: job.job_sources.name,
          status: job.status,
          review_status: job.review_status,
          scraped_at: job.scraped_at || job.created_at,
          company_id: job.company_id,
          job_type: job.job_type,
          salary: job.salary,
          url: job.url,
          country: job.country,
        })) || []

      return {
        data: transformedData,
        count: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      }
    } catch (error) {
      console.error("Error fetching job postings:", error)
      throw error
    }
  }

  // Get companies with pagination and search
  async getCompanies(
    options: {
      page?: number
      limit?: number
      search?: string
      is_customer?: boolean
      source?: string
    } = {},
  ) {
    const { page = 1, limit = 15, search = "", is_customer, source } = options

    try {
      let query = this.client.from("companies").select(
        `
          *,
          job_postings(count)
        `,
        { count: "exact" },
      )

      // Add search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`)
      }

      // Add customer filter
      if (is_customer !== undefined) {
        query = query.eq("is_customer", is_customer)
      }

      // Add source filter
      if (source) {
        query = query.eq("source", source)
      }

      // Add pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      // Order by created_at descending
      query = query.order("created_at", { ascending: false })

      const { data, error, count } = await query

      if (error) {
        throw error
      }

      // Transform data and get job counts
      const transformedData = await Promise.all(
        (data || []).map(async (company: any) => {
          // Get job count for this company
          const { count: jobCount } = await this.client
            .from("job_postings")
            .select("*", { count: "exact", head: true })
            .eq("company_id", company.id)

          return {
            ...company,
            job_count: jobCount || 0,
          }
        }),
      )

      return {
        data: transformedData,
        count: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      }
    } catch (error) {
      console.error("Error fetching companies:", error)
      throw error
    }
  }

  // Get company statistics
  async getCompanyStats() {
    try {
      // Get total companies
      const { count: totalCompanies } = await this.client.from("companies").select("*", { count: "exact", head: true })

      // Get customer companies
      const { count: customerCompanies } = await this.client
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("is_customer", true)

      // Get companies with ratings
      const { data: ratedCompanies } = await this.client
        .from("companies")
        .select("rating_indeed")
        .not("rating_indeed", "is", null)

      // Calculate average rating
      const averageRating =
        ratedCompanies && ratedCompanies.length > 0
          ? ratedCompanies.reduce((sum, company) => sum + (company.rating_indeed || 0), 0) / ratedCompanies.length
          : 0

      // Get companies with jobs
      const { data: companiesWithJobs } = await this.client.from("companies").select(`
          id,
          job_postings!inner(id)
        `)

      // Get top companies by job count
      const { data: topCompaniesData } = await this.client
        .from("companies")
        .select(`
          name,
          rating_indeed,
          job_postings(count)
        `)
        .limit(5)

      return {
        totalCompanies: totalCompanies || 0,
        customerCompanies: customerCompanies || 0,
        averageRating,
        companiesWithJobs: companiesWithJobs?.length || 0,
        topCompanies: topCompaniesData || [],
      }
    } catch (error) {
      console.error("Error fetching company stats:", error)
      return {
        totalCompanies: 0,
        customerCompanies: 0,
        averageRating: 0,
        companiesWithJobs: 0,
        topCompanies: [],
      }
    }
  }

  // Get company details with recent jobs
  async getCompanyDetails(companyId: string) {
    try {
      // Fetch company details
      const { data: company, error: companyError } = await this.client
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single()

      if (companyError) throw companyError

      // Fetch recent jobs for this company
      const { data: recentJobs, error: jobsError } = await this.client
        .from("job_postings")
        .select("id, title, location, status, review_status, created_at, job_type, salary")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (jobsError) throw jobsError

      // Get job count
      const { count } = await this.client
        .from("job_postings")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)

      return {
        id: company.id,
        name: company.name,
        website: company.website,
        indeed_url: company.indeed_url,
        logo_url: company.logo_url,
        location: company.location,
        description: company.description,
        rating_indeed: company.rating_indeed,
        review_count_indeed: company.review_count_indeed,
        size_min: company.size_min,
        size_max: company.size_max,
        is_customer: company.is_customer,
        source: company.source,
        job_count: count || 0,
        recent_jobs: recentJobs || [],
      }
    } catch (error) {
      console.error("Error fetching company details:", error)
      throw error
    }
  }

  // Get dashboard statistics
  async getDashboardStats() {
    try {
      // Get total job postings
      const { count: totalJobs } = await this.client.from("job_postings").select("*", { count: "exact", head: true })

      // Get total companies
      const { count: totalCompanies } = await this.client.from("companies").select("*", { count: "exact", head: true })

      // Get jobs by status
      const { data: statusStats } = await this.client.from("job_postings").select("status").not("status", "is", null)

      // Get jobs by review status
      const { data: reviewStats } = await this.client
        .from("job_postings")
        .select("review_status")
        .not("review_status", "is", null)

      // Get jobs scraped today
      const today = new Date().toISOString().split("T")[0]
      const { count: todayJobs } = await this.client
        .from("job_postings")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00.000Z`)

      // Get platform distribution
      const { data: platformStats } = await this.client
        .from("job_postings")
        .select(`
          job_sources!inner(name)
        `)
        .not("job_sources.name", "is", null)

      // Process platform stats
      const platformCounts = platformStats?.reduce((acc: any, job: any) => {
        const platform = job.job_sources.name
        acc[platform] = (acc[platform] || 0) + 1
        return acc
      }, {})

      // Process status stats
      const statusCounts = statusStats?.reduce((acc: any, job: any) => {
        acc[job.status] = (acc[job.status] || 0) + 1
        return acc
      }, {})

      return {
        totalJobs: totalJobs || 0,
        totalCompanies: totalCompanies || 0,
        todayJobs: todayJobs || 0,
        statusCounts: statusCounts || {},
        platformCounts: platformCounts || {},
        newJobs: statusCounts?.new || 0,
        pendingReview: reviewStats?.filter((r: any) => r.review_status === "pending").length || 0,
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error)
      return {
        totalJobs: 0,
        totalCompanies: 0,
        todayJobs: 0,
        statusCounts: {},
        platformCounts: {},
        newJobs: 0,
        pendingReview: 0,
      }
    }
  }

  // Create search request (for Otis)
  async createSearchRequest(query: string, userId?: string) {
    try {
      const { data, error } = await this.client
        .from("search_requests")
        .insert({
          query,
          user_id: userId,
          status: "pending",
          started_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error creating search request:", error)
      throw error
    }
  }

  // Update search request status
  async updateSearchRequest(id: string, status: string, finishedAt?: string) {
    try {
      const { data, error } = await this.client
        .from("search_requests")
        .update({
          status,
          finished_at: finishedAt || new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error("Error updating search request:", error)
      throw error
    }
  }

  // Insert new job posting (for Otis scraping)
  async insertJobPosting(jobData: {
    title: string
    company_name: string
    location: string
    platform: string
    external_vacancy_id?: string
    url?: string
    description?: string
    job_type?: string
    salary?: string
    country?: string
  }) {
    try {
      // First, find or create company
      let { data: company, error: companyError } = await this.client
        .from("companies")
        .select("id")
        .eq("name", jobData.company_name)
        .single()

      if (companyError && companyError.code === "PGRST116") {
        // Company doesn't exist, create it
        const { data: newCompany, error: createError } = await this.client
          .from("companies")
          .insert({
            name: jobData.company_name,
            location: jobData.location,
            source: "scraped",
          })
          .select("id")
          .single()

        if (createError) throw createError
        company = newCompany
      } else if (companyError) {
        throw companyError
      }

      // Find job source
      const { data: jobSource, error: sourceError } = await this.client
        .from("job_sources")
        .select("id")
        .eq("name", jobData.platform)
        .single()

      if (sourceError) throw sourceError

      // Insert job posting
      const { data: jobPosting, error: jobError } = await this.client
        .from("job_postings")
        .insert({
          title: jobData.title,
          company_id: company!.id,
          location: jobData.location,
          source_id: jobSource.id,
          external_vacancy_id: jobData.external_vacancy_id,
          url: jobData.url,
          description: jobData.description,
          job_type: jobData.job_type,
          salary: jobData.salary,
          country: jobData.country || "Netherlands",
          status: "new",
          review_status: "pending",
          scraped_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (jobError) throw jobError

      return jobPosting
    } catch (error) {
      console.error("Error inserting job posting:", error)
      throw error
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService()
