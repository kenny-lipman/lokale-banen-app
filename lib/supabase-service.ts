import { supabase } from "./supabase"
import type { Database } from "./supabase"

type JobPosting = Database["public"]["Tables"]["job_postings"]["Row"]
type Company = Database["public"]["Tables"]["companies"]["Row"]
type JobSource = Database["public"]["Tables"]["job_sources"]["Row"]
type SearchRequest = Database["public"]["Tables"]["search_requests"]["Row"]

export class SupabaseService {
  /** Use the singleton Supabase client instance */
  private get client() {
    return supabase
  }

  // Helper: haal bron-namen op per id (cache)
  private jobSourceNameCache: Record<string, string> = {}
  private async getJobSourceNameById(id: string): Promise<string | null> {
    if (!id) return null;
    if (this.jobSourceNameCache[id]) return this.jobSourceNameCache[id];
    const { data, error } = await this.client.from("job_sources").select("name").eq("id", id).single();
    if (error || !data?.name) return null;
    this.jobSourceNameCache[id] = data.name;
    return data.name;
  }

  // Cache voor alle job_sources (id -> name)
  private allJobSourcesMap: Record<string, string> = {};
  private async getAllJobSourcesMap(): Promise<Record<string, string>> {
    if (Object.keys(this.allJobSourcesMap).length > 0) return this.allJobSourcesMap;
    const { data, error } = await this.client.from("job_sources").select("id, name");
    if (error || !data) return {};
    this.allJobSourcesMap = Object.fromEntries((data as any[]).map((row) => [row.id, row.name]));
    return this.allJobSourcesMap;
  }

  async testConnection() {
    try {
      console.log("Testing Supabase connection...")
      
      // Test basic connection
      const { count, error } = await this.client
        .from("companies")
        .select("*", { count: "exact", head: true })
      
      if (error) {
        console.error("Connection test failed:", error)
        return { success: false, error: error.message }
      }

      // Test contacts table specifically
      const { count: contactsCount, error: contactsError } = await this.client
        .from("contacts")
        .select("*", { count: "exact", head: true })
      
      if (contactsError) {
        console.error("Contacts table test failed:", contactsError)
        return { 
          success: false, 
          error: `Contacts table error: ${contactsError.message}`,
          details: "The contacts table may not exist or you may not have access to it"
        }
      }

      console.log(`Connection successful. Companies: ${count}, Contacts: ${contactsCount}`)
      return { 
        success: true, 
        count: count || 0, 
        contactsCount: contactsCount || 0,
        message: "Connection successful to both companies and contacts tables"
      }
    } catch (error: any) {
      console.error("Connection test error:", error)
      return { success: false, error: error.message || "Unknown connection error" }
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
      region_id?: string
      source_id?: string
      regio_platform?: string // Add regio_platform filter
    } = {},
  ) {
    const { page = 1, limit = 10, search = "", status, review_status, region_id, source_id, regio_platform } = options

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
          source_id,
          region_id,
          job_type,
          salary,
          url,
          country,
          companies(name, website, logo_url, rating_indeed, is_customer),
          job_sources:source_id(id, name),
          regions(plaats,postcode,regio_platform,id)
        `,
        { count: "exact" },
      )

      // Add search filter using tsvector if available
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,location.ilike.%${search}%,job_type.ilike.%${search}%`,
        )
      }

      // Add status filters
      if (status) {
        query = query.eq("status", status)
      }

      if (review_status) {
        query = query.eq("review_status", review_status)
      }

      // Add region filter
      if (region_id === null) {
        query = query.is("region_id", null)
      } else if (region_id) {
        query = query.eq("region_id", region_id)
      }

      // Add source filter
      if (source_id) {
        query = query.eq("source_id", source_id)
      }

      // Add regio_platform filter
      if (regio_platform) {
        if (regio_platform === "none") {
          // Filter for jobs without regio_platform
          query = query.is("regions.regio_platform", null)
        } else {
          // Filter for specific regio_platform
          query = query.eq("regions.regio_platform", regio_platform)
        }
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
      const transformedData = await Promise.all((data || []).map(async (job: any) => {
        let platform = job.job_sources?.name || null;
        if (!platform && job.source_id) {
          platform = await this.getJobSourceNameById(job.source_id);
        }
        let region = "Onbekend";
        let regio_platform = null;
        if (Array.isArray(job.regions)) {
          const r = job.regions[0];
          if (r) {
            region = r.plaats + (r.regio_platform ? ` (${r.regio_platform})` : "");
            regio_platform = r.regio_platform;
          }
        } else if (job.regions && typeof job.regions === 'object') {
          region = job.regions.plaats + (job.regions.regio_platform ? ` (${job.regions.regio_platform})` : "");
          regio_platform = job.regions.regio_platform;
        }
        return {
          id: job.id,
          title: job.title,
          company_name: job.companies ? job.companies.name : "Onbekend",
          company_logo: job.companies ? job.companies.logo_url : undefined,
          company_website: job.companies ? job.companies.website : undefined,
          company_rating: job.companies ? job.companies.rating_indeed : undefined,
          is_customer: job.companies ? job.companies.is_customer : undefined,
          location: job.location,
          platform, // <-- altijd meesturen
          source_name: platform || null, // <-- altijd meesturen
          source_id: job.job_sources?.id || job.source_id || null,
          region,
          regio_platform, // Add regio_platform field
          status: job.status,
          review_status: job.review_status,
          scraped_at: job.scraped_at || job.created_at,
          company_id: job.company_id,
          job_type: job.job_type,
          salary: job.salary,
          url: job.url,
          country: job.country,
          region_id: job.region_id,
        }
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
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
      sizeRange?: { min: number, max: number|null }
      unknownSize?: boolean
      regionIds?: string[]
      status?: string
      websiteFilter?: 'all' | 'with' | 'without'
      categorySize?: 'all' | 'Klein' | 'Middel' | 'Groot' | 'Onbekend'
      apolloEnriched?: 'all' | 'enriched' | 'not_enriched'
      hasContacts?: 'all' | 'with_contacts' | 'no_contacts'
    } = {},
  ) {
    const { page = 1, limit = 50, search = "", is_customer, source, orderBy = 'created_at', orderDirection = 'desc', sizeRange, unknownSize, regionIds, status, websiteFilter, categorySize, apolloEnriched, hasContacts } = options

    try {
      console.log("getCompanies: Starting with params:", options)
      
      // Multi-filter validation and logging
      const activeFilters = []
      if (search) activeFilters.push('search')
      if (is_customer !== undefined) activeFilters.push('customer')
      if (source && source !== 'all') activeFilters.push('source')
      if (status && status !== 'all') activeFilters.push('status')
      if (websiteFilter && websiteFilter !== 'all') activeFilters.push('website')
      if (categorySize && categorySize !== 'all') activeFilters.push('categorySize')
      if (apolloEnriched && apolloEnriched !== 'all') activeFilters.push('apolloEnriched')
      if (hasContacts && hasContacts !== 'all') activeFilters.push('hasContacts')
      
      console.log("getCompanies: Active filters (AND logic):", activeFilters)
      
      // Special logging for contact filter debugging
      if (hasContacts && hasContacts !== 'all') {
        console.log("getCompanies: 🔍 CONTACT FILTER DEBUG - Filter type:", hasContacts)
      }
      
      // First, get companies without complex joins for better performance
      let query = this.client.from("companies").select(
        `*`,
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

      // Add status filter
      if (status && status !== "all") {
        query = query.eq("status", status)
      }

      // Add region filter
      if (regionIds && regionIds.length > 0) {
        query = query.in('region_id', regionIds)
      }

      // Add size range filter (overlap logic)
      if (unknownSize) {
        query = query.is('size_min', null).is('size_max', null)
      } else if (sizeRange) {
        const { min, max } = sizeRange
        if (max !== null) {
          query = query.filter('size_max', 'gte', min).or(`size_min.lte.${max},size_max.is.null`)
        } else {
          query = query.or(`size_max.gte.${min},and(size_max.is.null,size_min.gte.${min})`)
        }
      }

      // Website filter
      if (websiteFilter === 'with') {
        query = query.not('website', 'is', null)
          .not('website', 'ilike', '%null%')
          .not('website', 'ilike', '%undefined%')
          .not('website', 'eq', '')
      } else if (websiteFilter === 'without') {
        query = query.or('website.is.null,website.eq.,website.ilike.%null%,website.ilike.%undefined%')
      }

      // Category size filter
      if (categorySize && categorySize !== 'all') {
        query = query.eq('category_size', categorySize)
      }

      // Apollo enrichment filter
      if (apolloEnriched === 'enriched') {
        query = query.not('apollo_enriched_at', 'is', null)
      } else if (apolloEnriched === 'not_enriched') {
        query = query.is('apollo_enriched_at', null)
      }

      // Handle contacts filter with proper multi-filter AND logic
      let contactFilteredCompanyIds: string[] | null = null
      if (hasContacts && hasContacts !== 'all') {
        console.log("getCompanies: Applying contacts filter:", hasContacts)
        
        try {
          if (hasContacts === 'with_contacts') {
            // Get company IDs that have contacts
            const { data: companiesWithContacts, error: contactsError } = await this.client
              .from("contacts")
              .select("company_id")
              .not("company_id", "is", null)
            
            if (contactsError) {
              console.warn("getCompanies: Contacts filter error:", contactsError)
              contactFilteredCompanyIds = []
            } else {
              contactFilteredCompanyIds = [...new Set(companiesWithContacts.map(c => c.company_id))]
              console.log("getCompanies: Found", contactFilteredCompanyIds.length, "companies with contacts")
            }
          } else if (hasContacts === 'no_contacts') {
            // Get companies that DON'T have contacts using a more efficient approach
            const { data: companiesWithContacts, error: contactsError } = await this.client
              .from("contacts")
              .select("company_id")
              .not("company_id", "is", null)
            
            if (contactsError) {
              console.warn("getCompanies: Contacts filter error:", contactsError)
              contactFilteredCompanyIds = []
            } else {
              // Get companies WITHOUT contacts by getting all companies, then excluding those with contacts
              const companiesWithContactsIds = new Set(companiesWithContacts.map(c => c.company_id))
              
              // Get all company IDs, then filter out those with contacts
              const { data: allCompanies, error: allError } = await this.client
                .from("companies")
                .select("id")
              
              if (allError) {
                console.warn("getCompanies: Error getting all companies for no_contacts filter:", allError)
                contactFilteredCompanyIds = []
              } else {
                // Filter out companies that have contacts
                contactFilteredCompanyIds = allCompanies
                  .map(c => c.id)
                  .filter(id => !companiesWithContactsIds.has(id))
                console.log("getCompanies: Found", contactFilteredCompanyIds.length, "companies without contacts")
              }
            }
          }
          
          // Apply the contact filter using IN clause for both with_contacts and no_contacts
          if (contactFilteredCompanyIds !== null) {
            if (contactFilteredCompanyIds.length > 0) {
              query = query.in('id', contactFilteredCompanyIds)
              console.log("getCompanies: Applying contact filter for", contactFilteredCompanyIds.length, "companies")
            } else {
              // No matching companies found, return empty result
              console.log("getCompanies: No companies match contact filter, returning empty result")
              return { data: [], count: 0, totalPages: 0 }
            }
          }
        } catch (error) {
          console.error("getCompanies: Error applying contacts filter:", error)
          // Continue without contacts filter rather than failing completely
        }
      }

      // Add pagination
      const from = (page - 1) * limit
      const to = from + limit - 1
      query = query.range(from, to)

      // Order by selected column
      query = query.order(orderBy, { ascending: orderDirection === 'asc' })

      console.log("getCompanies: Executing main query...")
      const { data, error, count } = await query

      if (error) {
        console.error("getCompanies: Query error:", error)
        throw error
      }

      console.log("getCompanies: Main query successful, got", data?.length, "companies")

      // Get job sources mapping
      const jobSourcesMap = await this.getAllJobSourcesMap();
      console.log("getCompanies: Got job sources map with", Object.keys(jobSourcesMap).length, "sources")

      // Get job counts for all returned companies in batches to avoid limits
      const companyIds = (data || []).map(c => c.id)
      let jobCounts: Record<string, number> = {}
      let contactCounts: Record<string, number> = {}
      
      if (companyIds.length > 0) {
        console.log("getCompanies: Fetching job counts for", companyIds.length, "companies")
        try {
          // Use a more efficient aggregation query
          const { data: jobCountsData, error: jobCountsError } = await this.client
            .from("job_postings")
            .select("company_id")
            .in("company_id", companyIds)
            .not("company_id", "is", null)
          
          if (jobCountsError) {
            console.warn("getCompanies: Job counts query error:", jobCountsError)
            // Continue without job counts rather than failing
          } else {
            // Count occurrences of each company_id
            jobCounts = (jobCountsData || []).reduce((acc: Record<string, number>, row: any) => {
              acc[row.company_id] = (acc[row.company_id] || 0) + 1
              return acc
            }, {})
            console.log("getCompanies: Job counts calculated for", Object.keys(jobCounts).length, "companies")
          }
        } catch (jobCountError) {
          console.warn("getCompanies: Failed to get job counts:", jobCountError)
          // Continue without job counts
        }

        // Get contact counts for all returned companies
        console.log("getCompanies: Fetching contact counts for", companyIds.length, "companies")
        try {
          const { data: contactCountsData, error: contactCountsError } = await this.client
            .from("contacts")
            .select("company_id")
            .in("company_id", companyIds)
            .not("company_id", "is", null)
          
          if (contactCountsError) {
            console.warn("getCompanies: Contact counts query error:", contactCountsError)
            // Continue without contact counts rather than failing
          } else {
            // Count occurrences of each company_id
            contactCounts = (contactCountsData || []).reduce((acc: Record<string, number>, row: any) => {
              acc[row.company_id] = (acc[row.company_id] || 0) + 1
              return acc
            }, {})
            console.log("getCompanies: Contact counts calculated for", Object.keys(contactCounts).length, "companies")
          }
        } catch (contactCountError) {
          console.warn("getCompanies: Failed to get contact counts:", contactCountError)
          // Continue without contact counts
        }
      }

      // Get regions data for company_region mapping
      const { data: regions } = await this.client.from("regions").select("*")
      
      // Get recent job postings for each company to determine their region
      const companyIdsForRegions = (data || []).map(c => c.id)
      const companyRegions: Record<string, string | null> = {}
      
      if (companyIdsForRegions.length > 0) {
        try {
          // Get the most recent job posting for each company to determine region
          const { data: recentJobPostings } = await this.client
            .from("job_postings")
            .select("company_id, region_id")
            .in("company_id", companyIdsForRegions)
            .not("company_id", "is", null)
            .order("created_at", { ascending: false })
          
          // Create a map of company_id to region_id (using the most recent posting)
          const companyToRegionMap = new Map<string, string>()
          if (recentJobPostings) {
            recentJobPostings.forEach((posting: any) => {
              if (posting.company_id && !companyToRegionMap.has(posting.company_id)) {
                companyToRegionMap.set(posting.company_id, posting.region_id)
              }
            })
          }
          
          // Map region_id to regio_platform
          companyIdsForRegions.forEach(companyId => {
            const regionId = companyToRegionMap.get(companyId)
            if (regionId && regions) {
              const region = regions.find((r: any) => r.id === regionId)
              companyRegions[companyId] = region ? region.regio_platform : null
            } else {
              companyRegions[companyId] = null
            }
          })
        } catch (error) {
          console.warn("getCompanies: Error fetching company regions:", error)
          // Continue without region data
        }
      }

      // Transform data: combine all information
      const transformedData = (data || []).map((company: any) => {
        let source_name = null;
        if (company.source && jobSourcesMap[company.source]) {
          source_name = jobSourcesMap[company.source];
        }
        
        return {
          ...company,
          job_counts: jobCounts[company.id] || 0,
          contact_count: contactCounts[company.id] || 0,
          source_name: source_name,
          source_id: company.source,
          company_region: companyRegions[company.id] || null,
          enrichment_status: company.enrichment_status || null,
          // Computed filter fields for client-side validation
          has_apollo_enrichment: !!company.apollo_enriched_at,
          has_contacts: (contactCounts[company.id] || 0) > 0,
          // Filter metadata for debugging
          _filter_applied: activeFilters.length > 0 ? activeFilters : undefined,
        }
      })

      console.log("getCompanies: Successfully transformed", transformedData.length, "companies")

      // QA Validation: Ensure contact filter integrity
      if (hasContacts === 'no_contacts') {
        const companiesWithContactsInResult = transformedData.filter(c => c.contact_count > 0)
        if (companiesWithContactsInResult.length > 0) {
          console.error("🚨 QA VALIDATION FAILED: Found", companiesWithContactsInResult.length, "companies with contacts in 'no_contacts' filter result")
          console.error("🚨 Leaked companies:", companiesWithContactsInResult.map(c => ({ id: c.id, name: c.name, contact_count: c.contact_count })))
        } else {
          console.log("✅ QA VALIDATION PASSED: No companies with contacts in 'no_contacts' filter result")
        }
      }

      return {
        data: transformedData,
        count: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      }
    } catch (error) {
      console.error("getCompanies: Fatal error:", error)
      console.error("getCompanies: Error details:", JSON.stringify(error, null, 2))
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
      console.log("Dashboard: Starting getDashboardStats...")
      
      // Get total job postings
      const { count: totalJobs } = await this.client.from("job_postings").select("*", { count: "exact", head: true })
      console.log("Dashboard: Total jobs:", totalJobs)

      // Get total companies
      const { count: totalCompanies } = await this.client.from("companies").select("*", { count: "exact", head: true })
      console.log("Dashboard: Total companies:", totalCompanies)

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

      // NIEUWE SCHAALBARE PLATFORM VERDELING AANPAK
      console.log("Dashboard: Getting platform distribution...")
      
      // Stap 1: Haal alle job sources op
      const { data: allJobSources } = await this.client
        .from("job_sources")
        .select("id, name")
      
      console.log("Dashboard: Found job sources:", allJobSources?.map(s => s.name) || [])
      
      // Stap 2: Voor elke source, tel het aantal job_postings
      const platformCounts: Record<string, number> = {}
      
      // Tel ook job_postings zonder source_id
      const { count: jobsWithoutSource } = await this.client
        .from("job_postings")
        .select("*", { count: "exact", head: true })
        .is("source_id", null)
      
      if (jobsWithoutSource && jobsWithoutSource > 0) {
        platformCounts["Onbekend"] = jobsWithoutSource
        console.log("Dashboard: Jobs without source:", jobsWithoutSource)
      }
      
      // Voor elke bekende source, tel de job_postings
      if (allJobSources && allJobSources.length > 0) {
        for (const source of allJobSources) {
          const { count: jobCount } = await this.client
            .from("job_postings")
            .select("*", { count: "exact", head: true })
            .eq("source_id", source.id)
          
          if (jobCount && jobCount > 0) {
            platformCounts[source.name] = jobCount
            console.log(`Dashboard: ${source.name}: ${jobCount} jobs`)
          }
        }
      }

      console.log("Dashboard: Final platform counts:", platformCounts)

      // Process status stats
      const statusCounts = statusStats?.reduce((acc: any, job: any) => {
        acc[job.status] = (acc[job.status] || 0) + 1
        return acc
      }, {})

      const result = {
        totalJobs: totalJobs || 0,
        totalCompanies: totalCompanies || 0,
        todayJobs: todayJobs || 0,
        statusCounts: statusCounts || {},
        platformCounts: platformCounts || {},
        newJobs: statusCounts?.new || 0,
        pendingReview: reviewStats?.filter((r: any) => r.review_status === "pending").length || 0,
      }
      
      console.log("Dashboard: Returning stats:", JSON.stringify(result, null, 2))
      return result
      
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

  // Get Apify runs sorted by most recent (nu via view)
  async getApifyRuns() {
    try {
      const { data, error } = await this.client
        .from("apify_runs_with_platform")
        .select("*")
        .eq("actor_id", "hMvNSpz3JnHgl5jkh")
        .order("created_at", { ascending: false })
      if (error) throw error
      // Map naar frontend kolommen
      return (data || []).map((run: any) => ({
        ...run,
        platform: run.platform || null,
        functie: run.functie || run.title || '-',
        locatie: run.locatie || run.region || '-',
        job_count: run.job_count ?? run.status_message ?? '-',
      }))
    } catch (error) {
      console.error("Error fetching apify_runs_with_platform:", error)
      return []
    }
  }

  // Get job postings for a specific run
  async getJobPostingsByRunId(runId: string) {
    try {
      const { data, error } = await this.client
        .from("job_postings")
        .select("*")
        .eq("apify_run_id", runId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching job_postings by run_id:", error)
      return []
    }
  }

  async getScrapingResultsBySessionId(sessionId: string) {
    try {
      // Get session data
      const { data: session, error: sessionError } = await this.client
        .from("otis_workflow_sessions")
        .select("apify_run_id, scraping_status, job_count")
        .eq("session_id", sessionId)
        .single()

      if (sessionError) throw sessionError

      if (!session.apify_run_id) {
        return {
          status: 'pending',
          job_count: 0,
          companies: [],
          jobs: []
        }
      }

      // Get job postings and companies with more details
      const { data: jobPostings, error: jobsError } = await this.client
        .from("job_postings")
        .select(`
          id, title, location, url, job_type, salary, status, review_status, created_at,
          companies(id, name, website, location, status)
        `)
        .eq("apify_run_id", session.apify_run_id)
        .order("created_at", { ascending: false })

      if (jobsError) throw jobsError

      // Process companies
      const companiesMap = new Map()
      jobPostings?.forEach(job => {
        if (job.companies) {
          const companyId = job.companies.id
          if (!companiesMap.has(companyId)) {
            companiesMap.set(companyId, {
              id: companyId,
              name: job.companies.name,
              website: job.companies.website,
              location: job.companies.location,
              status: job.companies.status,
              job_count: 1,
              enrichment_status: 'pending'
            })
          } else {
            companiesMap.get(companyId).job_count++
          }
        }
      })

      // Process jobs for detailed view
      const jobs = jobPostings?.map(job => ({
        id: job.id,
        title: job.title,
        location: job.location,
        url: job.url,
        job_type: job.job_type,
        salary: job.salary,
        status: job.status,
        review_status: job.review_status,
        created_at: job.created_at,
        company: job.companies ? {
          id: job.companies.id,
          name: job.companies.name,
          website: job.companies.website,
          location: job.companies.location,
          status: job.companies.status
        } : null
      })) || []

      return {
        status: session.scraping_status,
        job_count: session.job_count || jobPostings?.length || 0,
        companies: Array.from(companiesMap.values()),
        jobs: jobs,
        apify_run_id: session.apify_run_id
      }

    } catch (error) {
      console.error("Error getting scraping results:", error)
      throw error
    }
  }

  async updateSessionApifyRun(sessionId: string, apifyRunId: string) {
    try {
      const { error } = await this.client
        .from("otis_workflow_sessions")
        .update({ 
          apify_run_id: apifyRunId,
          scraping_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq("session_id", sessionId)

      if (error) throw error
      return true

    } catch (error) {
      console.error("Error updating session with Apify run ID:", error)
      throw error
    }
  }

  // Get contacts with server-side pagination and filtering
  // Helper method to apply contact filters consistently
  private applyContactFilters(
    query: any,
    filters: {
      search?: string
      hoofddomein?: string[]
      size?: string[]
      campaign?: 'all' | 'with' | 'without'
      status?: string[]
      source?: string[]
      start?: string[]
      statusCampagne?: string[]
      statusBedrijf?: string[]
    }
  ) {
    // Apply search filter with proper text search
    if (filters.search && filters.search.trim() !== "") {
      const searchTerm = filters.search.trim()
      query = query.or(
        `first_name.ilike.%${searchTerm}%,` +
        `last_name.ilike.%${searchTerm}%,` +
        `name.ilike.%${searchTerm}%,` +
        `email.ilike.%${searchTerm}%,` +
        `title.ilike.%${searchTerm}%,` +
        `company_name.ilike.%${searchTerm}%`
      )
    }

    // Apply region filter (hoofddomein)
    if (filters.hoofddomein && filters.hoofddomein.length > 0) {
      query = query.in('company_region', filters.hoofddomein)
    }

    // Apply campaign filter
    if (filters.campaign && filters.campaign !== 'all') {
      if (filters.campaign === 'with') {
        query = query.not('campaign_name', 'is', null).not('campaign_name', 'eq', '')
      } else if (filters.campaign === 'without') {
        query = query.or('campaign_name.is.null,campaign_name.eq.')
      }
    }

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      query = query.in('company_status', filters.status)
    }

    // Apply size filter
    if (filters.size && filters.size.length > 0) {
      query = query.in('category_size', filters.size)
    }

    // Apply company status filter (Status Bedrijf PH)
    if (filters.statusBedrijf && filters.statusBedrijf.length > 0) {
      query = query.in('klant_status', filters.statusBedrijf)
    }

    // Apply source filter
    if (filters.source && filters.source.length > 0) {
      query = query.in('source_name', filters.source)
    }

    // Apply start filter
    if (filters.start && filters.start.length > 0) {
      query = query.in('start', filters.start)
    }

    // Apply campaign status filter (Status campagne)
    if (filters.statusCampagne && filters.statusCampagne.length > 0) {
      query = query.in('company_status_field', filters.statusCampagne)
    }

    return query
  }

  async getContactsPaginated(
    page: number = 1,
    limit: number = 15,
    filters: {
      search?: string
      hoofddomein?: string[]
      size?: string[]
      campaign?: 'all' | 'with' | 'without'
      status?: string[]
      source?: string[]
      start?: string[]
      statusCampagne?: string[]
      statusBedrijf?: string[]
    } = {}
  ) {
    try {
      console.log("Starting optimized getContactsPaginated with filters:", filters)
      
      // First, get the total count with filters to validate pagination
      let countQuery = this.client
        .from("contacts_optimized")
        .select("*", { count: 'exact', head: true })

      // Apply all filters to count query
      countQuery = this.applyContactFilters(countQuery, filters)
      
      const { count: totalCount, error: countError } = await countQuery
      
      if (countError) {
        console.error("Error getting total count:", countError)
        throw new Error(`Database error: ${countError.message}`)
      }

      // Calculate safe pagination values
      const safeTotalCount = totalCount || 0
      const maxPage = Math.ceil(safeTotalCount / limit)
      const safePage = Math.max(1, Math.min(page, maxPage || 1))
      const offset = (safePage - 1) * limit
      
      console.log(`Pagination: requested page ${page}, safe page ${safePage}, total count ${safeTotalCount}, max page ${maxPage}`)
      
      // Build the data query using the optimized view
      let query = this.client
        .from("contacts_optimized")
        .select("*")
        .order("last_touch", { ascending: false, nullsLast: true })
        .range(offset, offset + limit - 1)

      // Apply all filters to data query
      query = this.applyContactFilters(query, filters)

      // Execute the query
      const { data, error } = await query

      if (error) {
        console.error("Error fetching paginated contacts:", error)
        throw new Error(`Database error: ${error.message}`)
      }

      console.log(`Fetched ${data?.length || 0} contacts from optimized view (page ${safePage}, limit ${limit})`)

      const totalPages = Math.max(1, Math.ceil(safeTotalCount / limit))

      return {
        data: data || [],
        count: safeTotalCount,
        totalPages,
        currentPage: safePage,
        requestedPage: page
      }
    } catch (error) {
      console.error("Error in getContactsPaginated:", error)
      throw error
    }
  }

  // Get contact statistics for dashboard cards
  async getContactStats() {
    try {
      console.log("Getting contact statistics...")
      
      // Get total count
      const { count: totalCount, error: countError } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
      
      if (countError) {
        console.error("Error getting total count:", countError)
        throw new Error(`Count error: ${countError.message}`)
      }

      // Get campaign statistics server-side
      const { data: campaignStats, error: campaignError } = await this.client
        .from("contacts")
        .select("campaign_name")
        .or('campaign_name.is.null,campaign_name.eq.')

      if (campaignError) {
        console.error("Error getting campaign stats:", campaignError)
        throw new Error(`Campaign stats error: ${campaignError.message}`)
      }

      // Calculate statistics server-side
      const contactsWithoutCampaign = campaignStats?.length || 0
      const contactsWithCampaign = (totalCount || 0) - contactsWithoutCampaign

      // Get regions for unique regions list
      let regions: any[] = [];
      try {
        const { data: regionsData, error: regionsError } = await this.client.from("regions").select("id, plaats, regio_platform");
        if (regionsError) {
          console.error("Error fetching regions:", regionsError.message, regionsError)
        } else {
          regions = regionsData || [];
          console.log(`Fetched ${regions.length} regions for mapping`)
        }
      } catch (error) {
        console.error("Failed to fetch regions:", error instanceof Error ? error.message : String(error))
      }

      // Extract unique region platforms
      const uniqueRegions = Array.from(new Set(
        regions
          .map((r: any) => r.regio_platform)
          .filter((r: string): r is string => typeof r === "string" && r.trim() !== "")
      ))

      return {
        totalContacts: totalCount || 0,
        contactsWithCampaign,
        contactsWithoutCampaign,
        uniqueRegions
      }
    } catch (error) {
      console.error("Error in getContactStats:", error)
      throw error
    }
  }

  // Get all contacts with company info (legacy method - kept for backward compatibility)
  async getContacts() {
    try {
      console.log("Starting getContacts - fetching ALL contacts using pagination...")
      
      // Test eerst de count
      const { count: totalCount, error: countError } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
      
      if (countError) {
        console.error("Error counting contacts:", countError)
        throw new Error(`Count error: ${countError.message}`)
      }
      
      console.log(`Total contacts in database: ${totalCount}`)
      
      // Als er geen contacten zijn, return early
      if (!totalCount || totalCount === 0) {
        console.log("No contacts found in database")
        return []
      }

      // Gebruik paginatie om alle contacten op te halen
      const allContacts: any[] = []
      const pageSize = 1000 // PostgREST default limit
      let currentPage = 0
      
      while (true) {
        const startIndex = currentPage * pageSize
        const endIndex = startIndex + pageSize - 1
        
        console.log(`Fetching contacts ${startIndex}-${endIndex} (page ${currentPage + 1})...`)
        
        const { data, error } = await this.client
          .from("contacts")
          .select("*, companies(id, name, website, size_min, size_max, location, status, category_size, enrichment_status, start, \"Klant Status company field\")")
          .order("last_touch", { ascending: false })
          .range(startIndex, endIndex)
        
        if (error) {
          console.error(`Error fetching contacts page ${currentPage + 1}:`, error)
          throw new Error(`Database error on page ${currentPage + 1}: ${error.message}`)
        }

        if (!data || data.length === 0) {
          console.log(`No more contacts found at page ${currentPage + 1}`)
          break
        }

        console.log(`Retrieved ${data.length} contacts from page ${currentPage + 1}`)
        allContacts.push(...data)
        
        // Als we minder dan pageSize records krijgen, zijn we klaar
        if (data.length < pageSize) {
          console.log(`Last page reached (${data.length} < ${pageSize})`)
          break
        }
        
        currentPage++
        
        // Safety check om infinite loops te voorkomen
        if (currentPage > 50) {
          console.warn("Safety break: stopping after 50 pages")
          break
        }
      }

      console.log(`Successfully fetched all ${allContacts.length} contacts from ${currentPage + 1} pages`)

      const data = allContacts
      
      console.log(`Fetched ${data?.length || 0} contacts from database (expected: ${totalCount})`)

      // Haal alle regio's en bronnen op voor mapping
      let regions: any[] = [];
      let jobSources: any[] = [];
      
      try {
        const { data: regionsData, error: regionsError } = await this.client.from("regions").select("id, plaats, regio_platform");
        if (regionsError) {
          console.error("Error fetching regions:", regionsError.message, regionsError)
        } else {
          regions = regionsData || [];
          console.log(`Fetched ${regions.length} regions`)
        }
      } catch (error) {
        console.error("Failed to fetch regions:", error instanceof Error ? error.message : String(error))
      }

      try {
        const { data: sourcesData, error: sourcesError } = await this.client.from("job_sources").select("id, name");
        if (sourcesError) {
          console.error("Error fetching job sources:", sourcesError.message, sourcesError)
        } else {
          jobSources = sourcesData || [];
          console.log(`Fetched ${jobSources.length} job sources`)
        }
      } catch (error) {
        console.error("Failed to fetch job sources:", error instanceof Error ? error.message : String(error))
      }

      // Haal alle job_postings op (alleen meest recente per company_id)
      const companyIds = Array.from(new Set((data || []).map((c: any) => c.companies?.id).filter(Boolean)));
      const recentPostings: Record<string, any> = {};
      
      if (companyIds.length > 0) {
        console.log(`Fetching job postings for ${companyIds.length} companies...`)
        
        // Split company IDs in chunks van 500 om PostgreSQL limiet te vermijden (kleiner chunk voor meer stabiliteit)
        const chunkSize = 500;
        const chunks = [];
        for (let i = 0; i < companyIds.length; i += chunkSize) {
          chunks.push(companyIds.slice(i, i + chunkSize));
        }
        
        console.log(`Processing ${chunks.length} chunks of job postings...`)
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          try {
            console.log(`Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} company IDs...`)
            
            const { data: postings, error: postingsError } = await this.client
              .from("job_postings")
              .select("id, company_id, region_id, source_id, created_at")
              .in("company_id", chunk)
              .order("created_at", { ascending: false });
            
            if (postingsError) {
              console.error(`Error fetching job postings chunk ${i + 1}:`, postingsError.message, postingsError)
              continue; // Skip dit chunk en ga door met de volgende
            }

            console.log(`Chunk ${i + 1} returned ${postings?.length || 0} job postings`)

            // Per company_id: pak de eerste (meest recente)
            for (const posting of postings || []) {
              if (!recentPostings[posting.company_id]) {
                recentPostings[posting.company_id] = posting;
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.error(`Error processing job postings chunk ${i + 1}:`, errorMessage, error)
            continue; // Skip dit chunk en ga door
          }
        }
        
        console.log(`Successfully fetched postings for ${Object.keys(recentPostings).length} companies`)
      }

      // Transformeer elk contact zodat company.status, company_source_name en company_region beschikbaar zijn
      console.log(`Transforming ${data?.length || 0} contacts with mapping data...`)
      
      const result = (data || []).map((contact: any) => {
        try {
          const company_status = contact.companies ? contact.companies.status || null : null;
          let company_region = null;
          let company_source_name = null;
          const companyId = contact.companies?.id;
          
          if (companyId && recentPostings[companyId]) {
            const posting = recentPostings[companyId];
            // Regio
            if (posting.region_id && Array.isArray(regions)) {
              const reg = regions.find((r: any) => r.id === posting.region_id);
              company_region = reg ? reg.regio_platform : null;
            }
            // Bron
            if (posting.source_id && Array.isArray(jobSources)) {
              const src = jobSources.find((s: any) => s.id === posting.source_id);
              company_source_name = src ? src.name : null;
            }
          }
          
          return {
            ...contact,
            company_status,
            company_source_name,
            company_region,
          }
        } catch (error) {
          console.error("Error transforming contact:", contact.id, error)
          // Return contact zonder extra velden als transformatie faalt
          return {
            ...contact,
            company_status: contact.companies?.status || null,
            company_source_name: null,
            company_region: null,
          }
        }
      })

      console.log(`Successfully transformed ${result.length} contacts`)
      return result
    } catch (error) {
      console.error("Error in getContacts:", error)
      
      // Geef meer specifieke error informatie
      if (error instanceof Error) {
        throw new Error(`Failed to fetch contacts: ${error.message}`)
      } else {
        throw new Error(`Failed to fetch contacts: ${String(error)}`)
      }
    }
  }

  // Haal alle unieke sources op uit job_sources (id + name)
  async getCompanySources() {
    try {
      const { data, error } = await this.client
        .from("job_sources")
        .select("id, name")
        .order("name", { ascending: true })
      if (error) throw error
      // Filter lege of dubbele waarden uit
      const sources = Array.from(
        new Map((data || []).filter((row: any) => !!row.name && row.name.trim() !== "").map((row: any) => [row.id, { id: row.id, name: row.name }])).values()
      )
      return sources
    } catch (error) {
      console.error("Error fetching company sources:", error)
      return []
    }
  }

  // Haal alle job sources op met cost en webhook informatie
  async getJobSourcesWithCosts() {
    try {
      const { data, error } = await this.client
        .from("job_sources")
        .select("id, name, cost_per_1000_results, webhook_url, active")
        .eq("active", true)
        .order("name", { ascending: true })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching job sources with costs:", error)
      return []
    }
  }

  // Haal alle regio's op
  async getRegions() {
    try {
      const { data, error } = await this.client.from("regions").select("*").order("plaats", { ascending: true })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching regions:", error)
      return []
    }
  }

  // Haal alle bronnen op


  // Haal regio's op met het aantal gekoppelde vacatures (uit de view)
  async getRegionsWithJobPostingsCount() {
    try {
      const { data, error } = await this.client.from("regions_with_job_postings_count").select("*").order("plaats", { ascending: true })
      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching regions with job postings count:", error)
      return []
    }
  }

  // Haal bedrijven op die vacatures hebben in een bepaalde regio
  async getCompaniesByRegion(region_id: string) {
    try {
      // Zoek alle unieke company_id's met vacatures in deze regio
      const { data: postings, error: postingsError } = await this.client
        .from("job_postings")
        .select("company_id")
        .eq("region_id", region_id)
      if (postingsError) throw postingsError
      const companyIds = Array.from(new Set((postings || []).map((p: any) => p.company_id).filter(Boolean)))
      if (companyIds.length === 0) return []
      // Haal de bedrijven op
      const { data: companies, error: companiesError } = await this.client
        .from("companies")
        .select("*")
        .in("id", companyIds)
      if (companiesError) throw companiesError
      return companies || []
    } catch (error) {
      console.error("Error fetching companies by region:", error)
      return []
    }
  }

  async updateContactCampaignId(contactId: string, campaignId: string) {
    try {
      const { error } = await this.client
        .from("contacts")
        .update({ campaign_id: campaignId })
        .eq("id", contactId)
      if (error) throw error
    } catch (error) {
      console.error("Error updating contact campaign_id:", error)
      throw error
    }
  }

  async updateContactCampaignInfo(contactId: string, campaignId: string, campaignName: string) {
    try {
      const { error } = await this.client
        .from("contacts")
        .update({ campaign_id: campaignId, campaign_name: campaignName })
        .eq("id", contactId)
      if (error) throw error
    } catch (error) {
      console.error("Error updating contact campaign info:", error)
      throw error
    }
  }

  async updateCompaniesStatus(companyIds: string[], status: string) {
    if (!Array.isArray(companyIds) || companyIds.length === 0) return;
    try {
      const { error } = await this.client
        .from("companies")
        .update({ status })
        .in("id", companyIds)
      if (error) throw error
    } catch (error) {
      console.error("Error updating companies status:", error)
      throw error
    }
  }

  async getCompanyStatusCounts() {
    try {
      // Gebruik een SQL query via rpc voor group by status
      const { data, error } = await this.client.rpc("company_status_counts")
      if (error) throw error
      // Maak een mapping van status naar count
      const counts: Record<string, number> = {}
      for (const row of data || []) {
        const status = row.status || "Prospect"
        counts[status] = Number(row.count) || 0
      }
      // Zorg dat alle statussen altijd aanwezig zijn
      ["Prospect", "Qualified", "Disqualified"].forEach((status) => {
        if (!(status in counts)) counts[status] = 0
      })
      return counts
    } catch (error) {
      console.error("Error fetching company status counts:", error)
      return { Prospect: 0, Qualified: 0, Disqualified: 0 }
    }
  }

  // Get contact statistics using the materialized view
  async getContactStatsOptimized() {
    try {
      console.log("Getting contact statistics from materialized view...")
      
      const { data, error } = await this.client
        .from("contacts_stats")
        .select("*")
        .single()
      
      if (error) {
        console.error("Error fetching contact stats:", error)
        // Fallback to manual calculation if materialized view fails
        return await this.getContactStats()
      }
      
      return {
        totalContacts: data?.total_contacts || 0,
        contactsWithCampaign: data?.contacts_with_campaign || 0,
        contactsWithoutCampaign: data?.contacts_without_campaign || 0,
        uniqueRegions: data?.unique_regions || 0,
        uniqueSizes: data?.unique_sizes || 0,
        uniqueStatuses: data?.unique_statuses || 0
      }
    } catch (error) {
      console.error("Error in getContactStatsOptimized:", error)
      // Return default values instead of throwing
      return {
        totalContacts: 0,
        contactsWithCampaign: 0,
        contactsWithoutCampaign: 0,
        uniqueRegions: 0,
        uniqueSizes: 0,
        uniqueStatuses: 0
      }
    }
  }

  // Optimized contact search - using the working getContactsPaginated method
  async searchContactsOptimized(
    page: number = 1,
    limit: number = 15,
    filters: {
      search?: string
      hoofddomein?: string[]
      size?: string[]
      campaign?: 'all' | 'with' | 'without'
      status?: string[]
      source?: string[]
      start?: string[]
      statusCampagne?: string[]
      statusBedrijf?: string[]
    } = {}
  ) {
    try {
      console.log("Starting optimized contact search with filters:", filters)
      
      // Use the working getContactsPaginated method directly
      const result = await this.getContactsPaginated(page, limit, filters)
      
      console.log(`Optimized search returned ${result?.data?.length || 0} contacts`)
      
      return result
    } catch (error) {
      console.error("Error in searchContactsOptimized:", error)
      // Return empty result instead of throwing
      return {
        data: [],
        count: 0,
        totalPages: 1
      }
    }
  }

  // Get all available filter options for contacts
  async getContactFilterOptions() {
    try {
      console.log("Getting contact filter options...")
      
      // Get all unique values for each filter field
      const { data: sizeData, error: sizeError } = await this.client
        .from("contacts_optimized")
        .select("category_size")
        .not("category_size", "is", null)
        .not("category_size", "eq", "")
      
      const { data: bedrijfStatusData, error: bedrijfStatusError } = await this.client
        .from("contacts_optimized")
        .select("company_status_field")
        .not("company_status_field", "is", null)
        .not("company_status_field", "eq", "")
      
      const { data: campagneStatusData, error: campagneStatusError } = await this.client
        .from("contacts_optimized")
        .select("klant_status")
        .not("klant_status", "is", null)
        .not("klant_status", "eq", "")
      
      if (sizeError || bedrijfStatusError || campagneStatusError) {
        console.error("Error fetching filter options:", { sizeError, bedrijfStatusError, campagneStatusError })
        throw new Error("Failed to fetch filter options")
      }
      
      // Extract unique values
      const sizes = Array.from(new Set((sizeData || []).map((item: any) => item.category_size)))
      const bedrijfStatuses = Array.from(new Set((bedrijfStatusData || []).map((item: any) => item.company_status_field)))
      const campagneStatuses = Array.from(new Set((campagneStatusData || []).map((item: any) => item.klant_status)))
      
      return {
        sizes: sizes.sort(),
        bedrijfStatuses: bedrijfStatuses.sort(),
        campagneStatuses: campagneStatuses.sort()
      }
    } catch (error) {
      console.error("Error in getContactFilterOptions:", error)
      return {
        sizes: [],
        bedrijfStatuses: [],
        campagneStatuses: []
      }
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService()
