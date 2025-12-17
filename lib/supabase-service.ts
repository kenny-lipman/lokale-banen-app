import { createClient, createServiceRoleClient } from "./supabase"
import type { Database } from "./supabase"

type JobPosting = Database["public"]["Tables"]["job_postings"]["Row"]
type Company = Database["public"]["Tables"]["companies"]["Row"]
type JobSource = Database["public"]["Tables"]["job_sources"]["Row"]
type SearchRequest = Database["public"]["Tables"]["search_requests"]["Row"]

export class SupabaseService {
  /** Use authenticated client for operations that respect RLS and user permissions */
  get client() {
    return createClient()
  }

  /** Use service role client for server-side operations that need full access and bypass RLS */
  get serviceClient() {
    return createServiceRoleClient()
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
      platform_id?: string
      source_id?: string
      regio_platform?: string // Add regio_platform filter
    } = {},
  ) {
    const { page = 1, limit = 10, search = "", status, review_status, platform_id, source_id, regio_platform } = options

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
          platform_id,
          job_type,
          salary,
          url,
          country,
          companies(name, website, logo_url, rating_indeed, is_customer),
          job_sources:source_id(id, name),
          platforms:platform_id(id, regio_platform, central_place, central_postcode)
        `,
        { count: "exact" },
      )

      // Add search filter - note: job_type is an array so we can't use ilike on it
      if (search) {
        query = query.or(
          `title.ilike.%${search}%,location.ilike.%${search}%`,
        )
      }

      // Add status filters
      if (status) {
        query = query.eq("status", status)
      }

      if (review_status) {
        query = query.eq("review_status", review_status)
      }

      // Add platform filter
      if (platform_id === null) {
        query = query.is("platform_id", null)
      } else if (platform_id) {
        query = query.eq("platform_id", platform_id)
      }

      // Add source filter
      if (source_id) {
        query = query.eq("source_id", source_id)
      }

      // Add pagination BEFORE executing the query
      const from = (page - 1) * limit
      const to = from + limit - 1
      
      // Order by created_at descending
      query = query.order("created_at", { ascending: false })
      
      // Execute query
      const { data, error, count } = await query.range(from, to)

      if (error) {
        throw error
      }

      // Filter by regio_platform after fetching (PostgREST limitation)
      let filteredData = data || []
      if (regio_platform) {
        filteredData = filteredData.filter((job: any) => {
          if (regio_platform === "none") {
            return !job.platforms || !job.platforms.regio_platform
          } else {
            return job.platforms && job.platforms.regio_platform === regio_platform
          }
        })
      }

      // Transform data
      const transformedData = await Promise.all(filteredData.map(async (job: any) => {
        let platform = job.job_sources?.name || null;
        if (!platform && job.source_id) {
          platform = await this.getJobSourceNameById(job.source_id);
        }
        let region = "Onbekend";
        let regio_platform = null;
        if (Array.isArray(job.platforms)) {
          const p = job.platforms[0];
          if (p) {
            region = p.central_place + (p.regio_platform ? ` (${p.regio_platform})` : "");
            regio_platform = p.regio_platform;
          }
        } else if (job.platforms && typeof job.platforms === 'object') {
          region = job.platforms.central_place + (job.platforms.regio_platform ? ` (${job.platforms.regio_platform})` : "");
          regio_platform = job.platforms.regio_platform;
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
          platform_id: job.platform_id,
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
      regioPlatformFilter?: string
      pipedriveFilter?: 'all' | 'synced' | 'not_synced'
      instantlyFilter?: 'all' | 'synced' | 'not_synced'
      qualification_status?: 'pending' | 'qualified' | 'disqualified' | 'review' | 'all'
      dateFrom?: string
      dateTo?: string
    } = {},
  ) {
    const { page = 1, limit = 50, search = "", is_customer, source, orderBy = 'created_at', orderDirection = 'desc', sizeRange, unknownSize, regionIds, status, websiteFilter, categorySize, apolloEnriched, hasContacts, regioPlatformFilter, pipedriveFilter, instantlyFilter, qualification_status, dateFrom, dateTo } = options

    try {
      console.log("getCompanies: Starting with params:", options)
      
      // Multi-filter validation and logging
      const activeFilters: string[] = []
      if (search) activeFilters.push('search')
      if (is_customer !== undefined) activeFilters.push('customer')
      if (source && source !== 'all') activeFilters.push('source')
      if (status && status !== 'all') activeFilters.push('status')
      if (websiteFilter && websiteFilter !== 'all') activeFilters.push('website')
      if (categorySize && categorySize !== 'all') activeFilters.push('categorySize')
      if (apolloEnriched && apolloEnriched !== 'all') activeFilters.push('apolloEnriched')
      if (hasContacts && hasContacts !== 'all') activeFilters.push('hasContacts')
      if (regioPlatformFilter && regioPlatformFilter !== 'all') activeFilters.push('regioPlatformFilter')
      if (qualification_status && qualification_status !== 'all') activeFilters.push('qualification_status')
      
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

      // Pipedrive sync filter
      if (pipedriveFilter === 'synced') {
        query = query.eq('pipedrive_synced', true)
      } else if (pipedriveFilter === 'not_synced') {
        query = query.or('pipedrive_synced.is.null,pipedrive_synced.eq.false')
      }

      // Instantly sync filter - for companies, we need to check via contacts
      // Companies don't have directly instantly_synced, but we can check if any contact linked to this company is synced
      // For now, check if company has pipedrive_id (which means it was synced via Instantly -> Pipedrive flow)
      // We'll add proper instantly_synced column to companies later if needed
      if (instantlyFilter === 'synced') {
        // Companies synced via Instantly have pipedrive_id set via the sync flow
        query = query.not('pipedrive_id', 'is', null)
      } else if (instantlyFilter === 'not_synced') {
        query = query.is('pipedrive_id', null)
      }

      // Qualification status filter for tab-based view
      if (qualification_status && qualification_status !== 'all') {
        console.log("getCompanies: Applying qualification_status filter:", qualification_status)
        if (qualification_status === 'pending') {
          // For 'pending', include both null and 'pending' values to handle transition period
          query = query.or('qualification_status.is.null,qualification_status.eq.pending')
        } else {
          query = query.eq('qualification_status', qualification_status)
        }
      }

      // Date range filter (created_at)
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00Z`)
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59Z`)
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

      // Handle regio_platform filter (hoofddomein) - supports multi-select
      let regioPlatformFilteredCompanyIds: string[] | null = null
      if (regioPlatformFilter && regioPlatformFilter !== 'all') {
        // Parse multi-select values (comma-separated)
        const selectedPlatforms = regioPlatformFilter.split(',').map(p => p.trim()).filter(p => p)
        console.log("getCompanies: Applying regio_platform filter:", selectedPlatforms)

        try {
          const hasNoneFilter = selectedPlatforms.includes('none')
          const specificPlatforms = selectedPlatforms.filter(p => p !== 'none')

          let companiesWithSpecificPlatforms: string[] = []
          let companiesWithoutPlatform: string[] = []

          // Handle specific platform selections
          if (specificPlatforms.length > 0) {
            // First get the platform IDs for the selected regio_platforms
            const { data: platformsData, error: platformsError } = await this.client
              .from("platforms")
              .select("id")
              .in("regio_platform", specificPlatforms)

            if (platformsError) {
              console.warn("getCompanies: Error fetching platform IDs:", platformsError)
            } else if (platformsData && platformsData.length > 0) {
              const platformIds = platformsData.map(p => p.id)

              // Now get company IDs that have job_postings with these platform_ids
              const { data: companiesWithRegioPlatform, error: regioPlatformError } = await this.client
                .from("job_postings")
                .select("company_id")
                .in("platform_id", platformIds)
                .not("company_id", "is", null)

              if (regioPlatformError) {
                console.warn("getCompanies: RegioPlatform filter error:", regioPlatformError)
              } else {
                companiesWithSpecificPlatforms = [...new Set(companiesWithRegioPlatform.map(c => c.company_id))]
                console.log("getCompanies: Found", companiesWithSpecificPlatforms.length, "companies with selected platforms:", specificPlatforms)
              }
            }
          }

          // Handle "none" filter (companies without any hoofddomein)
          if (hasNoneFilter) {
            // Get companies that have job_postings with a valid platform_id
            const { data: companiesWithAnyPlatform, error: anyPlatformError } = await this.client
              .from("job_postings")
              .select("company_id")
              .not("platform_id", "is", null)
              .not("company_id", "is", null)

            if (anyPlatformError) {
              console.warn("getCompanies: RegioPlatform 'none' filter error:", anyPlatformError)
            } else {
              const companiesWithPlatformIds = new Set(companiesWithAnyPlatform.map(c => c.company_id))

              // Get all company IDs, then filter out those with any platform
              const { data: allCompanies, error: allError } = await this.client
                .from("companies")
                .select("id")

              if (allError) {
                console.warn("getCompanies: Error getting all companies for none filter:", allError)
              } else {
                companiesWithoutPlatform = allCompanies
                  .map(c => c.id)
                  .filter(id => !companiesWithPlatformIds.has(id))
                console.log("getCompanies: Found", companiesWithoutPlatform.length, "companies without any platform")
              }
            }
          }

          // Combine results (OR logic for multi-select)
          regioPlatformFilteredCompanyIds = [...new Set([...companiesWithSpecificPlatforms, ...companiesWithoutPlatform])]

          // Apply the regio_platform filter using IN clause
          if (regioPlatformFilteredCompanyIds.length > 0) {
            query = query.in('id', regioPlatformFilteredCompanyIds)
            console.log("getCompanies: Applying regio_platform filter for", regioPlatformFilteredCompanyIds.length, "companies")
          } else {
            // No matching companies found, return empty result
            console.log("getCompanies: No companies match regio_platform filter, returning empty result")
            return { data: [], count: 0, totalPages: 0 }
          }
        } catch (error) {
          console.error("getCompanies: Error applying regio_platform filter:", error)
          // Continue without regio_platform filter rather than failing completely
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
      let instantlySyncedCompanies: Record<string, boolean> = {}
      
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

        // Get contact counts and instantly sync status for all returned companies
        console.log("getCompanies: Fetching contact counts for", companyIds.length, "companies")
        try {
          const { data: contactCountsData, error: contactCountsError } = await this.client
            .from("contacts")
            .select("company_id, instantly_synced")
            .in("company_id", companyIds)
            .not("company_id", "is", null)

          if (contactCountsError) {
            console.warn("getCompanies: Contact counts query error:", contactCountsError)
            // Continue without contact counts rather than failing
          } else {
            // Count occurrences of each company_id and check instantly_synced status
            contactCounts = (contactCountsData || []).reduce((acc: Record<string, number>, row: any) => {
              acc[row.company_id] = (acc[row.company_id] || 0) + 1
              return acc
            }, {})
            // Check if any contact for each company has instantly_synced = true
            instantlySyncedCompanies = (contactCountsData || []).reduce((acc: Record<string, boolean>, row: any) => {
              if (row.instantly_synced) {
                acc[row.company_id] = true
              } else if (acc[row.company_id] === undefined) {
                acc[row.company_id] = false
              }
              return acc
            }, {})
            console.log("getCompanies: Contact counts calculated for", Object.keys(contactCounts).length, "companies")
            console.log("getCompanies: Instantly synced status calculated for", Object.keys(instantlySyncedCompanies).length, "companies")
          }
        } catch (contactCountError) {
          console.warn("getCompanies: Failed to get contact counts:", contactCountError)
          // Continue without contact counts
        }
      }

      // Get platforms data for company_platform mapping
      const { data: platforms } = await this.client.from("platforms").select("*")
      
      // Get recent job postings for each company to determine their platform
      const companyIdsForPlatforms = (data || []).map(c => c.id)
      const companyPlatforms: Record<string, string | null> = {}
      
      if (companyIdsForPlatforms.length > 0) {
        try {
          // Get the most recent job posting for each company to determine platform
          const { data: recentJobPostings } = await this.client
            .from("job_postings")
            .select("company_id, platform_id")
            .in("company_id", companyIdsForPlatforms)
            .not("company_id", "is", null)
            .order("created_at", { ascending: false })
          
          // Create a map of company_id to platform_id (using the most recent posting)
          const companyToPlatformMap = new Map<string, string>()
          if (recentJobPostings) {
            recentJobPostings.forEach((posting: any) => {
              if (posting.company_id && !companyToPlatformMap.has(posting.company_id)) {
                companyToPlatformMap.set(posting.company_id, posting.platform_id)
              }
            })
          }
          
          // Map platform_id to regio_platform
          companyIdsForPlatforms.forEach(companyId => {
            const platformId = companyToPlatformMap.get(companyId)
            if (platformId && platforms) {
              const platform = platforms.find((p: any) => p.id === platformId)
              companyPlatforms[companyId] = platform ? platform.regio_platform : null
            } else {
              companyPlatforms[companyId] = null
            }
          })
        } catch (error) {
          console.warn("getCompanies: Error fetching company platforms:", error)
          // Continue without platform data
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
          company_region: companyPlatforms[company.id] || null,
          enrichment_status: company.enrichment_status || null,
          pipedrive_synced: company.pipedrive_synced || false,
          pipedrive_synced_at: company.pipedrive_synced_at || null,
          // Instantly sync status (derived from contacts)
          instantly_synced: instantlySyncedCompanies[company.id] || false,
          // Additional company details for drawer
          linkedin_url: company.linkedin_url || null,
          kvk: company.kvk || null,
          phone: company.phone || null,
          industries: company.industries || null,
          category_size: company.category_size || null,
          apollo_enriched_at: company.apollo_enriched_at || null,
          apollo_contacts_count: company.apollo_contacts_count || null,
          created_at: company.created_at || null,
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
      qualificationStatus?: string
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

    // Apply qualification status filter based on selected tab
    // After migration, only use the qualification_status field directly
    if (filters.qualificationStatus) {
      switch (filters.qualificationStatus) {
        case 'in_campaign':
          // Contacts with qualification_status = 'in_campaign'
          query = query.eq('qualification_status', 'in_campaign')
          break
        case 'qualified':
          // Contacts with qualification_status = 'qualified'
          query = query.eq('qualification_status', 'qualified')
          break
        case 'disqualified':
          // Contacts with qualification_status = 'disqualified'
          query = query.eq('qualification_status', 'disqualified')
          break
        case 'review':
          // Contacts with qualification_status = 'review'
          query = query.eq('qualification_status', 'review')
          break
        case 'pending':
          // Contacts with qualification_status = 'pending'
          query = query.eq('qualification_status', 'pending')
          break
      }
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
      qualificationStatus?: string
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
        .order("last_touch", { ascending: false, nullsFirst: false })
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

      // Get campaign statistics using proper aggregation
      const { data: withCampaignData, error: withCampaignError } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .not('campaign_id', 'is', null)

      if (withCampaignError) {
        console.error("Error getting with campaign stats:", withCampaignError)
        throw new Error(`With campaign stats error: ${withCampaignError.message}`)
      }

      const { data: withoutCampaignData, error: withoutCampaignError } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .is('campaign_id', null)

      if (withoutCampaignError) {
        console.error("Error getting without campaign stats:", withoutCampaignError)
        throw new Error(`Without campaign stats error: ${withoutCampaignError.message}`)
      }

      // Calculate statistics from counts
      const contactsWithCampaign = withCampaignData || 0
      const contactsWithoutCampaign = withoutCampaignData || 0

      // Get regions for unique regions list
      let platforms: any[] = [];
      try {
        const { data: platformsData, error: platformsError } = await this.client.from("platforms").select("id, central_place, regio_platform");
        if (platformsError) {
          console.error("Error fetching platforms:", platformsError.message, platformsError)
        } else {
          platforms = platformsData || [];
          console.log(`Fetched ${platforms.length} platforms for mapping`)
        }
      } catch (error) {
        console.error("Failed to fetch platforms:", error instanceof Error ? error.message : String(error))
      }

      // Extract unique region platforms
      const uniqueRegions = Array.from(new Set(
        platforms
          .map((p: any) => p.regio_platform)
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
      console.log("Starting getContacts - fetching contacts with required columns...")
      
      // Get contacts with only the required columns
      const { data: contacts, error } = await this.client
        .from("contacts")
        .select(`
          first_name,
          last_name,
          title,
          email,
          email_status,
          qualification_status,
          linkedin_url,
          created_at,
          campaign_name,
          pipedrive_synced,
          pipedrive_synced_at,
          company_id,
          company_status,
          status,
          companies:company_id(
            name,
            category_size
          )
        `)
        .order("created_at", { ascending: false })
      
      if (error) {
        console.error("Error fetching contacts:", error)
        throw new Error(`Failed to fetch contacts: ${error.message}`)
      }
      
      console.log(`Successfully fetched ${contacts?.length || 0} contacts`)
      
      return (contacts || []).map((contact: any) => ({
        id: contact.id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title,
        email: contact.email,
        email_status: contact.email_status,
        source: contact.source,
        company_id: contact.company_id,
        companies_name: contact.companies?.name || null,
        companies_size: contact.companies?.category_size || null,
        companies_status: contact.companies?.status || null,
        companies_start: contact.companies?.start || null,
        qualification_status: contact.qualification_status,
        linkedin_url: contact.linkedin_url,
        created_at: contact.created_at,
        campaign_name: contact.campaign_name,
        company_status: contact.company_status,
        status: contact.status,
        pipedrive_synced: contact.pipedrive_synced,
        pipedrive_synced_at: contact.pipedrive_synced_at
      }))
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

  async getContactsWithFilters(
    page: number = 1,
    limit: number = 15,
    filters: {
      search?: string
      inCampaign?: string
      hasEmail?: string
      companyStatus?: string
      companyStart?: string
      companySize?: string
      categoryStatus?: string
      status?: string
    } = {}
  ) {
    try {
      console.log("Starting getContactsWithFilters with filters:", filters)
      
      // If we have a search term that might include company name, do a more complex query
      if (filters.search && filters.search.trim()) {
        const searchTerm = filters.search.trim()
        
        // First, find company IDs that match the search term
        const { data: matchingCompanies } = await this.client
          .from("companies")
          .select("id")
          .ilike("name", `%${searchTerm}%`)
        
        const companyIds = matchingCompanies?.map(c => c.id) || []
        
        // Build the main query
        let query = this.client
          .from("contacts")
          .select(`
            id,
            first_name,
            last_name,
            title,
            email,
            phone,
            email_status,
            source,
            qualification_status,
            linkedin_url,
            created_at,
            campaign_name,
            campaign_id,
            company_id,
            company_status,
            status,
            pipedrive_synced,
            pipedrive_synced_at,
            companies:company_id(
              name,
              category_size,
              status,
              start
            )
          `, { count: 'exact' })

        // Apply search filter with company IDs
        // Enhanced search: support full name search (first_name + last_name)
        let searchConditions = [
          `first_name.ilike.%${searchTerm}%`,
          `last_name.ilike.%${searchTerm}%`, 
          `email.ilike.%${searchTerm}%`
        ]
        
        // If search term contains a space, also search for "first_name last_name" pattern
        if (searchTerm.includes(' ')) {
          const nameParts = searchTerm.split(' ').filter(part => part.trim())
          if (nameParts.length >= 2) {
            const [firstName, ...lastNameParts] = nameParts
            const lastName = lastNameParts.join(' ')
            // Add search for first name matching first part AND last name matching remaining parts
            searchConditions.push(`and(first_name.ilike.%${firstName}%,last_name.ilike.%${lastName}%)`)
          }
        }
        
        // Limit company IDs to prevent 414 errors - only include if reasonable number
        if (companyIds.length > 0 && companyIds.length <= 100) {
          searchConditions.push(`company_id.in.(${companyIds.join(',')})`)
        } else if (companyIds.length > 100) {
          console.log(`Warning: Too many matching companies (${companyIds.length}), limiting to first 100 to prevent URL too long error`)
          searchConditions.push(`company_id.in.(${companyIds.slice(0, 100).join(',')})`)
        }
        
        query = query.or(searchConditions.join(','))
        
        // Apply other filters
        if (filters.inCampaign === 'with') {
          query = query.not('campaign_id', 'is', null)
        } else if (filters.inCampaign === 'without') {
          query = query.is('campaign_id', null)
        }

        if (filters.hasEmail === 'with') {
          query = query.not('email', 'is', null).not('email', 'eq', '')
        } else if (filters.hasEmail === 'without') {
          query = query.or('email.is.null,email.eq.')
        }

        // Handle company-based filters - always use direct approach to avoid 414 errors
        if (filters.companyStatus || filters.companyStart || filters.companySize) {
          console.log('Company filters detected, using direct filtering approach')
          return await this.handleDirectCompanyFiltering(filters, page, limit)
        }

        if (filters.categoryStatus) {
          const categoryValues = filters.categoryStatus.split(',').map(s => s.trim())
          query = query.in('qualification_status', categoryValues)
        }

        if (filters.status) {
          query = query.eq('status', filters.status)
        }

        // Add pagination and ordering
        const offset = (page - 1) * limit
        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)

        const { data: contacts, count, error } = await query
        
        if (error) {
          console.error("Error fetching contacts with search:", error)
          throw new Error(`Failed to fetch contacts: ${error.message}`)
        }
        
        console.log(`Successfully fetched ${contacts?.length || 0} contacts with search`)
        if (filters.companyStart || filters.companyStatus) {
          console.log('Sample contact data:', contacts?.[0])
        }
        
        const transformedContacts = (contacts || []).map((contact: any) => ({
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          email_status: contact.email_status,
          source: contact.source,
          companies_name: contact.companies?.name || null,
          companies_size: contact.companies?.category_size || null,
          companies_status: contact.companies?.status || null,
          companies_start: contact.companies?.start || null,
          qualification_status: contact.qualification_status,
          linkedin_url: contact.linkedin_url,
          created_at: contact.created_at,
          campaign_name: contact.campaign_name,
          company_status: contact.company_status,
          status: contact.status,
          company_id: contact.company_id,
          pipedrive_synced: contact.pipedrive_synced,
          pipedrive_synced_at: contact.pipedrive_synced_at,
          in_campaign: contact.campaign_id && contact.campaign_id.trim() !== '',
      pipedrive_synced: contact.pipedrive_synced,
      pipedrive_synced_at: contact.pipedrive_synced_at
        }))

        return {
          data: transformedContacts,
          count: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      } else {
        // No search term, use simpler query
        let query = this.client
          .from("contacts")
          .select(`
            id,
            first_name,
            last_name,
            title,
            email,
            phone,
            email_status,
            source,
            qualification_status,
            linkedin_url,
            created_at,
            campaign_name,
            campaign_id,
            company_id,
            company_status,
            status,
            pipedrive_synced,
            pipedrive_synced_at,
            companies:company_id(
              name,
              category_size,
              status,
              start
            )
          `, { count: 'exact' })

        // Apply filters
        if (filters.inCampaign === 'with') {
          query = query.not('campaign_id', 'is', null)
        } else if (filters.inCampaign === 'without') {
          query = query.is('campaign_id', null)
        }

        if (filters.hasEmail === 'with') {
          query = query.not('email', 'is', null).not('email', 'eq', '')
        } else if (filters.hasEmail === 'without') {
          query = query.or('email.is.null,email.eq.')
        }

        // Handle company-based filters - always use direct approach to avoid 414 errors
        if (filters.companyStatus || filters.companyStart || filters.companySize) {
          console.log('Company filters detected, using direct filtering approach')
          return await this.handleDirectCompanyFiltering(filters, page, limit)
        }

        if (filters.categoryStatus) {
          const categoryValues = filters.categoryStatus.split(',').map(s => s.trim())
          query = query.in('qualification_status', categoryValues)
        }

        if (filters.status) {
          query = query.eq('status', filters.status)
        }

        // Add pagination and ordering
        const offset = (page - 1) * limit
        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)

        const { data: contacts, count, error } = await query
        
        if (error) {
          console.error("Error fetching contacts with filters:", error)
          throw new Error(`Failed to fetch contacts: ${error.message}`)
        }
        
        console.log(`Successfully fetched ${contacts?.length || 0} contacts with filters`)
        if (filters.companyStart || filters.companyStatus) {
          console.log('Sample contact data:', contacts?.[0])
        }
        
        const transformedContacts = (contacts || []).map((contact: any) => ({
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          title: contact.title,
          email: contact.email,
          phone: contact.phone,
          email_status: contact.email_status,
          source: contact.source,
          companies_name: contact.companies?.name || null,
          companies_size: contact.companies?.category_size || null,
          companies_status: contact.companies?.status || null,
          companies_start: contact.companies?.start || null,
          qualification_status: contact.qualification_status,
          linkedin_url: contact.linkedin_url,
          created_at: contact.created_at,
          campaign_name: contact.campaign_name,
          company_status: contact.company_status,
          status: contact.status,
          company_id: contact.company_id,
          pipedrive_synced: contact.pipedrive_synced,
          pipedrive_synced_at: contact.pipedrive_synced_at,
          in_campaign: contact.campaign_id && contact.campaign_id.trim() !== '',
      pipedrive_synced: contact.pipedrive_synced,
      pipedrive_synced_at: contact.pipedrive_synced_at
        }))

        return {
          data: transformedContacts,
          count: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
      
    } catch (error) {
      console.error("Error in getContactsWithFilters:", error)
      
      if (error instanceof Error) {
        throw new Error(`Failed to fetch contacts with filters: ${error.message}`)
      } else {
        throw new Error(`Failed to fetch contacts with filters: ${String(error)}`)
      }
    }
  }

  // Helper method to handle large company ID lists using chunking
  private async handleLargeCompanyFilter(
    companyIds: string[], 
    baseQuery: any,
    page: number,
    limit: number,
    filters: any
  ) {
    console.log(`Processing ${companyIds.length} company IDs in chunks...`)
    
    // For very large result sets, we'll use a different approach:
    // Get all contacts for the first chunk and estimate total count
    const chunkSize = 500
    const offset = (page - 1) * limit
    
    // We need to get contacts from multiple chunks to handle pagination
    // Calculate which chunk contains our desired offset
    let allContacts: any[] = []
    let processedCount = 0
    let totalCount = 0
    
    for (let i = 0; i < companyIds.length; i += chunkSize) {
      const chunk = companyIds.slice(i, i + chunkSize)
      
      // Query this chunk
      let chunkQuery = this.client
        .from("contacts")
        .select(`
          id,
          first_name,
          last_name,
          title,
          email,
          phone,
          email_status,
          source,
          qualification_status,
          linkedin_url,
          created_at,
          campaign_name,
          pipedrive_synced,
          pipedrive_synced_at,
          campaign_id,
          company_status,
          status,
          companies:company_id(
            name,
            category_size,
            status,
            start
          )
        `, { count: 'exact' })
        .in('company_id', chunk)
      
      // Apply other filters
      if (filters.inCampaign === 'with') {
        chunkQuery.not('campaign_id', 'is', null)
      } else if (filters.inCampaign === 'without') {
        chunkQuery.is('campaign_id', null)
      }

      if (filters.hasEmail === 'with') {
        chunkQuery.not('email', 'is', null).not('email', 'eq', '')
      } else if (filters.hasEmail === 'without') {
        chunkQuery.or('email.is.null,email.eq.')
      }

      if (filters.categoryStatus) {
        const categoryValues = filters.categoryStatus.split(',').map(s => s.trim())
        chunkQuery = chunkQuery.in('qualification_status', categoryValues)
      }

      if (filters.status) {
        chunkQuery.eq('status', filters.status)
      }
      
      const { data: chunkContacts, count: chunkCount } = await chunkQuery.order("created_at", { ascending: false })
      
      if (chunkContacts) {
        allContacts.push(...chunkContacts)
        totalCount += chunkCount || 0
      }
      
      processedCount += chunk.length
      console.log(`Processed chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(companyIds.length/chunkSize)}: ${chunkContacts?.length || 0} contacts`)
      
      // Early exit if we have enough data for this page
      if (allContacts.length >= offset + limit) {
        break
      }
    }
    
    // Apply pagination to the combined results
    const paginatedContacts = allContacts.slice(offset, offset + limit)
    
    // Transform the contacts
    const transformedContacts = paginatedContacts.map((contact: any) => ({
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.title,
      email: contact.email,
      email_status: contact.email_status,
      source: contact.source,
      companies_name: contact.companies?.name || null,
      companies_size: contact.companies?.category_size || null,
      companies_status: contact.companies?.status || null,
      companies_start: contact.companies?.start || null,
      qualification_status: contact.qualification_status,
      linkedin_url: contact.linkedin_url,
      created_at: contact.created_at,
      campaign_name: contact.campaign_name,
      company_status: contact.company_status,
      status: contact.status,
      in_campaign: contact.campaign_id && contact.campaign_id.trim() !== '',
      pipedrive_synced: contact.pipedrive_synced,
      pipedrive_synced_at: contact.pipedrive_synced_at
    }))

    console.log(`Chunked processing complete: ${transformedContacts.length} contacts returned (est. total: ${totalCount})`)

    return {
      data: transformedContacts,
      count: Math.min(totalCount, allContacts.length), // Use actual count we retrieved
      totalPages: Math.ceil(totalCount / limit)
    }
  }

  // Helper method to handle company-based filtering using chunked multi-query approach
  private async handleDirectCompanyFiltering(
    filters: any,
    page: number,
    limit: number
  ) {
    console.log('Using chunked multi-query company filtering approach to bypass 414 errors...')
    
    const offset = (page - 1) * limit
    
    // Step 1: Find companies that match our criteria in small batches
    let companyQuery = this.client.from('companies').select('id')
    
    if (filters.companyStatus) {
      console.log(`Applying companyStatus filter: ${filters.companyStatus}`)
      const statusValues = filters.companyStatus.split(',').map(s => s.trim())
      
      // Handle null values separately
      const hasNull = statusValues.includes('null')
      const nonNullValues = statusValues.filter(s => s !== 'null')
      
      if (hasNull && nonNullValues.length > 0) {
        // Handle both null and non-null values
        const mappedStatuses = nonNullValues.map(status => {
          const statusMap = {
            'benaderen': 'Benaderen',
            'prospect': 'Prospect', 
            'disqualified': 'Disqualified',
            'niet meer benaderen': 'Niet meer benaderen'
          } as const
          return statusMap[status.toLowerCase() as keyof typeof statusMap] || status
        })
        companyQuery = companyQuery.or(`status.is.null,status.in.("${mappedStatuses.join('","')}")`)
      } else if (hasNull) {
        // Only null values
        companyQuery = companyQuery.is('status', null)
      } else {
        // Only non-null values - use IN for multiple values
        const mappedStatuses = nonNullValues.map(status => {
          const statusMap = {
            'benaderen': 'Benaderen',
            'prospect': 'Prospect', 
            'disqualified': 'Disqualified',
            'niet meer benaderen': 'Niet meer benaderen'
          } as const
          return statusMap[status.toLowerCase() as keyof typeof statusMap] || status
        })
        console.log(`Mapped status filters: ${mappedStatuses.join(',')}`)
        companyQuery = companyQuery.in('status', mappedStatuses)
      }
    }
    
    if (filters.companyStart) {
      console.log(`Applying companyStart filter: ${filters.companyStart}`)
      const startValues = filters.companyStart.split(',').map(s => s.trim())
      
      // Handle null values separately
      const hasNull = startValues.includes('null')
      const nonNullValues = startValues.filter(s => s !== 'null')
      
      if (hasNull && nonNullValues.length > 0) {
        // Handle both null and non-null values
        const mappedStarts = nonNullValues.map(start => {
          const startMap = {
            'true': 'Ja',
            'false': 'Nee', 
            'hold': 'Hold'
          } as const
          return startMap[start.toLowerCase() as keyof typeof startMap] || start
        })
        companyQuery = companyQuery.or(`start.is.null,start.in.("${mappedStarts.join('","')}")`)
      } else if (hasNull) {
        // Only null values
        companyQuery = companyQuery.is('start', null)
      } else {
        // Only non-null values - use IN for multiple values
        const mappedStarts = nonNullValues.map(start => {
          const startMap = {
            'true': 'Ja',
            'false': 'Nee', 
            'hold': 'Hold'
          } as const
          return startMap[start.toLowerCase() as keyof typeof startMap] || start
        })
        console.log(`Mapped start filters: ${mappedStarts.join(',')}`)
        companyQuery = companyQuery.in('start', mappedStarts)
      }
    }
    
    if (filters.companySize) {
      console.log(`Applying companySize filter: ${filters.companySize}`)
      const sizeValues = filters.companySize.split(',').map(s => s.trim())
      
      // Handle null values separately
      const hasNull = sizeValues.includes('null')
      const nonNullValues = sizeValues.filter(s => s !== 'null')
      
      if (hasNull && nonNullValues.length > 0) {
        // Handle both null and non-null values
        const mappedSizes = nonNullValues.map(size => {
          const sizeMap = {
            'klein': 'Klein',
            'middel': 'Middel', 
            'groot': 'Groot',
            'micro': 'Micro'
          } as const
          return sizeMap[size.toLowerCase() as keyof typeof sizeMap] || size
        })
        companyQuery = companyQuery.or(`category_size.is.null,category_size.in.("${mappedSizes.join('","')}")`)
      } else if (hasNull) {
        // Only null values
        companyQuery = companyQuery.is('category_size', null)
      } else {
        // Only non-null values
        const mappedSizes = nonNullValues.map(size => {
          const sizeMap = {
            'klein': 'Klein',
            'middel': 'Middel', 
            'groot': 'Groot',
            'micro': 'Micro'
          } as const
          return sizeMap[size.toLowerCase() as keyof typeof sizeMap] || size
        })
        console.log(`Mapped size filters: ${mappedSizes.join(',')}`)
        companyQuery = companyQuery.in('category_size', mappedSizes)
      }
    }
    
    // Get actual companies to determine count (avoid query builder reuse issues)
    console.log('DEBUG: Attempting to fetch actual company data to verify and count...')
    const { data: debugCompanies, error: debugError } = await companyQuery
      .select('id, status')
      .limit(1000)  // Get up to 1000 companies to count
    
    if (debugError) {
      console.error('Error fetching companies:', debugError)
      console.error('Error details:', JSON.stringify(debugError, null, 2))
      throw debugError
    }
    
    const totalCompanyCount = debugCompanies?.length || 0
    console.log(`Found ${totalCompanyCount} companies matching filters`)
    
    if (debugCompanies && debugCompanies.length > 0) {
      console.log('DEBUG: Sample companies found:', debugCompanies.slice(0, 5))
    } else {
      console.log('DEBUG: No companies returned from query')
    }
    
    if (!totalCompanyCount || totalCompanyCount === 0) {
      console.log('No companies found with the specified filters. Let me check what statuses exist...')
      
      // Debug: Get a sample of actual company statuses and sizes
      const { data: sampleCompanies, error: sampleError } = await this.client
        .from('companies')
        .select('id, status, category_size, size_min, size_max')
        .not('status', 'is', null)
        .limit(10)
      
      if (!sampleError && sampleCompanies) {
        const uniqueStatuses = [...new Set(sampleCompanies.map(c => c.status))]
        const uniqueSizes = [...new Set(sampleCompanies.map(c => c.category_size).filter(Boolean))]
        console.log('Sample company statuses in database:', uniqueStatuses)
        console.log('Sample company sizes in database:', uniqueSizes)
      }
      
      return {
        data: [],
        count: 0,
        totalPages: 0
      }
    }
    
    // Step 2: Process companies in chunks to find contacts
    const chunkSize = 50 // Small chunk size to avoid 414 errors
    let allContacts: any[] = []
    let processedContacts = 0
    let totalContactCount = 0
    
    // Calculate how many chunks we need to process to get enough contacts for this page
    const targetContactsNeeded = offset + limit
    
    // Use the companies we already fetched instead of making new queries
    const allCompanyIds = debugCompanies.map(c => c.id)
    
    for (let batchStart = 0; batchStart < allCompanyIds.length; batchStart += chunkSize) {
      // Get a batch of company IDs from our already-fetched data
      const companyIds = allCompanyIds.slice(batchStart, batchStart + chunkSize)
      
      if (!companyIds || companyIds.length === 0) break
      
      console.log(`Processing company batch ${Math.floor(batchStart/chunkSize) + 1}: ${companyIds.length} companies`)
      
      // Query contacts for this batch of companies
      let contactQuery = this.client
        .from("contacts")
        .select(`
          id,
          first_name,
          last_name,
          title,
          email,
          phone,
          email_status,
          source,
          qualification_status,
          linkedin_url,
          created_at,
          campaign_name,
          pipedrive_synced,
          pipedrive_synced_at,
          campaign_id,
          company_id,
          company_status,
          status,
          companies:company_id(
            name,
            category_size,
            status,
            start
          )
        `)
        .in('company_id', companyIds)
      
      // Apply non-company filters
      if (filters.inCampaign === 'with') {
        contactQuery = contactQuery.not('campaign_id', 'is', null)
      } else if (filters.inCampaign === 'without') {
        contactQuery = contactQuery.is('campaign_id', null)
      }

      if (filters.hasEmail === 'with') {
        contactQuery = contactQuery.not('email', 'is', null).not('email', 'eq', '')
      } else if (filters.hasEmail === 'without') {
        contactQuery = contactQuery.or('email.is.null,email.eq.')
      }

      if (filters.categoryStatus) {
        const categoryValues = filters.categoryStatus.split(',').map(s => s.trim())
        contactQuery = contactQuery.in('qualification_status', categoryValues)
      }

      if (filters.status) {
        contactQuery = contactQuery.eq('status', filters.status)
      }

      const { data: batchContacts, error } = await contactQuery
        .order("created_at", { ascending: false })
      
      if (error) {
        console.error('Error with batch contact query:', error)
        throw error
      }
      
      if (batchContacts && batchContacts.length > 0) {
        allContacts.push(...batchContacts)
        console.log(`Found ${batchContacts.length} contacts in this batch, total so far: ${allContacts.length}`)
      }
      
      // If we have enough contacts for pagination, we can break early
      if (allContacts.length >= targetContactsNeeded) {
        console.log(`Have enough contacts (${allContacts.length}) for pagination, stopping early`)
        break
      }
    }
    
    // Step 3: Sort all contacts and apply pagination
    allContacts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    // Apply pagination to the sorted results
    const paginatedContacts = allContacts.slice(offset, offset + limit)
    
    console.log(`Chunked filtering complete: returning ${paginatedContacts.length} contacts (${allContacts.length} total found)`)

    // Transform the contacts
    const transformedContacts = (paginatedContacts || []).map((contact: any) => ({
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      email_status: contact.email_status,
      source: contact.source,
      companies_name: contact.companies?.name || null,
      companies_size: contact.companies?.category_size || null,
      companies_status: contact.companies?.status || null,
      companies_start: contact.companies?.start || null,
      qualification_status: contact.qualification_status,
      linkedin_url: contact.linkedin_url,
      created_at: contact.created_at,
      campaign_name: contact.campaign_name,
      company_status: contact.company_status,
      status: contact.status,
      in_campaign: contact.campaign_id && contact.campaign_id.trim() !== '',
      pipedrive_synced: contact.pipedrive_synced,
      pipedrive_synced_at: contact.pipedrive_synced_at
    }))

    return {
      data: transformedContacts,
      count: allContacts.length,
      totalPages: Math.ceil(allContacts.length / limit)
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

  // Haal alle regio's op - now using platforms table
  async getRegions() {
    try {
      // Get all platforms with their cities for backward compatibility
      const { data: platforms, error: platformsError } = await this.client
        .from("platforms")
        .select("id, regio_platform, central_place, central_postcode")
        .order("regio_platform", { ascending: true })
      
      if (platformsError) throw platformsError
      
      // Transform to match old regions structure for compatibility
      const regions = (platforms || []).map(p => ({
        id: p.id,
        regio_platform: p.regio_platform,
        plaats: p.central_place,
        postcode: p.central_postcode
      }))
      
      return regions
    } catch (error) {
      console.error("Error fetching regions:", error)
      return []
    }
  }

  // Get regions that have active central places 
  async getActiveRegions() {
    try {
      // First get all active platforms to know which platforms are active
      const { data: activePlatforms, error: platformsError } = await this.client
        .from("platforms")
        .select("regio_platform")
        .eq("is_active", true)

      if (platformsError) throw platformsError

      const activePlatformsList = activePlatforms?.map(p => p.regio_platform) || []
      
      if (activePlatformsList.length === 0) {
        return []
      }

      // Get cities that belong to active platforms
      const { data, error } = await this.client
        .from("cities")
        .select("*")
        .in("regio_platform", activePlatformsList)
        .order("plaats", { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error("Error fetching active regions:", error)
      return []
    }
  }

  // Get all unique regio_platform values for hoofddomein filter
  // Uses materialized view to avoid 1000 row query limit issue
  async getUniqueRegioPlatforms() {
    try {
      const { data, error } = await this.client
        .from("unique_regio_platforms")
        .select("regio_platform")
      
      if (error) throw error
      
      // Data is already unique and sorted from the materialized view
      return (data || []).map((row: any) => row.regio_platform).filter(
        (platform): platform is string => typeof platform === "string" && platform.trim() !== ""
      )
    } catch (error) {
      console.error("Error fetching unique regio platforms:", error)
      return []
    }
  }

  // Get company counts by qualification status for tab badges
  async getCompanyCountsByQualificationStatus(filters?: {
    search?: string
    is_customer?: boolean
    source?: string
    websiteFilter?: 'all' | 'with' | 'without'
    categorySize?: 'all' | 'Klein' | 'Middel' | 'Groot' | 'Onbekend'
    apolloEnriched?: 'all' | 'enriched' | 'not_enriched'
    hasContacts?: 'all' | 'with_contacts' | 'no_contacts'
    regioPlatformFilter?: string
  }) {
    try {
      const counts = {
        pending: 0,
        qualified: 0,
        review: 0,
        disqualified: 0,
        enriched: 0
      }

      // Get counts for each status in parallel
      const statusQueries = ['pending', 'qualified', 'review', 'disqualified', 'enriched'].map(async (status) => {
        const result = await this.getCompanies({
          ...filters,
          qualification_status: status as any,
          page: 1,
          limit: 1 // We only need the count, not the data
        })
        return { status, count: result.count || 0 }
      })

      const results = await Promise.all(statusQueries)
      
      results.forEach(({ status, count }) => {
        counts[status as keyof typeof counts] = count
      })

      return counts
    } catch (error) {
      console.error("Error fetching company counts by qualification status:", error)
      return {
        pending: 0,
        qualified: 0,
        review: 0,
        disqualified: 0,
        enriched: 0
      }
    }
  }

  // Haal alle bronnen op


  // Haal cities op met het aantal gekoppelde vacatures (uit de view)
  async getCitiesWithJobPostingsCount() {
    try {
      // Use the cities_with_job_postings_count view directly
      const { data, error } = await this.client
        .from("cities_with_job_postings_count")
        .select("*")
        .order("plaats", { ascending: true })
        
      if (error) {
        console.error("Error fetching from cities_with_job_postings_count view:", error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error("Error fetching cities with job postings count:", error)
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

      // Try to get stats from materialized view first
      const { data: statsData, error: statsError } = await this.client
        .from("contact_stats_mv")
        .select("*")
        .eq("stat_type", "total")
        .single()

      if (statsError) {
        console.error("Error getting stats from materialized view:", statsError)
        // Fallback to manual calculation if materialized view fails
        return await this.getContactStatsManual()
      }

      if (!statsData) {
        console.log("No stats data found, falling back to manual calculation")
        return await this.getContactStatsManual()
      }

      console.log("Successfully retrieved stats from materialized view:", statsData)

      // Get regions for unique regions list
      let platforms: any[] = [];
      try {
        const { data: platformsData, error: platformsError } = await this.client.from("platforms").select("id, central_place, regio_platform");
        if (platformsError) {
          console.error("Error fetching platforms:", platformsError.message, platformsError)
        } else {
          platforms = platformsData || [];
          console.log(`Fetched ${platforms.length} platforms for mapping`)
        }
      } catch (error) {
        console.error("Failed to fetch platforms:", error instanceof Error ? error.message : String(error))
      }

      // Extract unique region platforms
      const uniqueRegions = Array.from(new Set(
        platforms
          .map((p: any) => p.regio_platform)
          .filter((r: string): r is string => typeof r === "string" && r.trim() !== "")
      ))

      return {
        totalContacts: statsData.total_contacts || 0,
        contactsWithCampaign: statsData.contacts_with_campaign || 0,
        contactsWithoutCampaign: (statsData.total_contacts || 0) - (statsData.contacts_with_campaign || 0),
        qualifiedContacts: statsData.qualified_contacts || 0,
        reviewContacts: statsData.review_contacts || 0,
        disqualifiedContacts: statsData.disqualified_contacts || 0,
        pendingContacts: statsData.pending_contacts || 0,
        uniqueRegions
      }
    } catch (error) {
      console.error("Error in getContactStatsOptimized:", error)
      // Return default values instead of throwing
      return {
        totalContacts: 0,
        contactsWithCampaign: 0,
        contactsWithoutCampaign: 0,
        qualifiedContacts: 0,
        reviewContacts: 0,
        disqualifiedContacts: 0,
        pendingContacts: 0,
        uniqueRegions: []
      }
    }
  }

  async getContactStatsManual() {
    try {
      console.log("Calculating contact statistics manually...")

      // Get total contacts count
      const { count: totalContacts, error: totalError } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })

      if (totalError) {
        console.error("Error getting total contacts:", totalError)
        throw totalError
      }

      // Get counts for each qualification status
      const { count: inCampaignCount } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .or('qualification_status.eq.in_campaign,and(qualification_status.is.null,campaign_id.not.is.null,campaign_id.neq.)')

      const { count: qualifiedCount } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .or('qualification_status.eq.qualified,and(qualification_status.is.null,status.eq.Qualified)')

      const { count: reviewCount } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .or('qualification_status.eq.review,and(qualification_status.is.null,status.eq.Review),and(qualification_status.is.null,status.eq.review)')

      const { count: disqualifiedCount } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .or('qualification_status.eq.disqualified,and(qualification_status.is.null,status.eq.Disqualified)')

      const { count: pendingCount } = await this.client
        .from("contacts")
        .select("*", { count: 'exact', head: true })
        .or('qualification_status.eq.pending,and(qualification_status.is.null,status.is.null,campaign_id.is.null),and(qualification_status.is.null,status.eq.pending,campaign_id.is.null),and(qualification_status.is.null,status.eq.Prospect,campaign_id.is.null),and(qualification_status.is.null,status.is.null,campaign_id.eq.),and(qualification_status.is.null,status.eq.pending,campaign_id.eq.),and(qualification_status.is.null,status.eq.Prospect,campaign_id.eq.)')

      // Get regions
      let platforms: any[] = [];
      try {
        const { data: platformsData } = await this.client.from("platforms").select("id, central_place, regio_platform");
        platforms = platformsData || [];
      } catch (platformError) {
        console.error("Failed to fetch platforms:", platformError)
      }

      // Extract unique region platforms
      const uniqueRegions = Array.from(new Set(
        platforms
          .map((p: any) => p.regio_platform)
          .filter((r: string): r is string => typeof r === "string" && r.trim() !== "")
      ))

      const stats = {
        totalContacts: totalContacts || 0,
        contactsWithCampaign: inCampaignCount || 0,
        contactsWithoutCampaign: (totalContacts || 0) - (inCampaignCount || 0),
        qualifiedContacts: qualifiedCount || 0,
        reviewContacts: reviewCount || 0,
        disqualifiedContacts: disqualifiedCount || 0,
        pendingContacts: pendingCount || 0,
        uniqueRegions
      }

      console.log("Manual stats calculation result:", stats)
      return stats

    } catch (error) {
      console.error("Error in getContactStatsManual:", error)
      // Return default values instead of throwing
      return {
        totalContacts: 0,
        contactsWithCampaign: 0,
        contactsWithoutCampaign: 0,
        qualifiedContacts: 0,
        reviewContacts: 0,
        disqualifiedContacts: 0,
        pendingContacts: 0,
        uniqueRegions: []
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
      qualificationStatus?: string
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

  // Get all available platforms from the platforms table  
  async getPlatforms() {
    try {
      console.log("Loading ALL platforms from platforms table (active & inactive)...")
      
      // Get ALL platforms with pagination - no filtering by is_active
      let allPlatformsData: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      let hasError = false
      
      while (hasMore && !hasError) {
        console.log(`Fetching platforms page ${page + 1}...`)
        const { data: platformsData, error: platformsError } = await this.serviceClient
          .from("platforms")
          .select("regio_platform")
          .not("regio_platform", "is", null)
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order("regio_platform", { ascending: true })
        
        if (platformsError) {
          console.log("❌ Error fetching platforms page", page + 1, ":", platformsError?.message)
          hasError = true
          break
        }
        
        if (platformsData && platformsData.length > 0) {
          console.log(`📦 Page ${page + 1}: Found ${platformsData.length} platforms`)
          allPlatformsData.push(...platformsData)
          hasMore = platformsData.length === pageSize
          page++
        } else {
          console.log(`📋 Page ${page + 1}: No more platforms found, stopping pagination`)
          hasMore = false
        }
      }
      
      // Always try to return platform data if we have any, even if there was an error on later pages
      if (allPlatformsData.length > 0) {
        const platforms = allPlatformsData.map((item: any) => item.regio_platform)
        console.log(`✅ SUCCESS: Found ${platforms.length} total platforms from platforms table`)
        console.log("First 10 platforms:", platforms.slice(0, 10))
        console.log("Last 10 platforms:", platforms.slice(-10))
        
        // Check for platforms with different letters
        const rPlatforms = platforms.filter(p => p.startsWith('R'))
        const tPlatforms = platforms.filter(p => p.startsWith('T'))
        const wPlatforms = platforms.filter(p => p.startsWith('W'))
        
        console.log(`🔤 R platforms: ${rPlatforms.length}`, rPlatforms)
        console.log(`🔤 T platforms: ${tPlatforms.length}`, tPlatforms)
        console.log(`🔤 W platforms: ${wPlatforms.length}`, wPlatforms)
        
        return platforms
      }
      
      console.log("⚠️ No platforms found in platforms table, falling back to cities table")
      
      // Fallback to unique platforms from cities table if platforms table fails
      console.log("Falling back to unique platforms from cities table...")
      const { data: citiesData, error: citiesError } = await this.serviceClient
        .from("cities")
        .select("regio_platform")
        .not("regio_platform", "is", null)
        .not("regio_platform", "eq", "")
      
      if (citiesError) throw citiesError
      
      const uniquePlatforms = Array.from(new Set((citiesData || []).map((item: any) => item.regio_platform)))
      console.log(`Fallback: Found ${uniquePlatforms.length} unique platforms from cities`)
      
      return uniquePlatforms.sort()
      
    } catch (error) {
      console.error("Error fetching platforms:", error)
      return []
    }
  }

  // Create a new platform in the platforms table
  async createPlatform(platformData: {
    regio_platform: string
    central_place: string
    central_postcode: string
    is_active?: boolean
  }) {
    try {
      console.log("Creating new platform:", platformData.regio_platform)
      
      const { data, error } = await this.serviceClient
        .from("platforms")
        .insert([{
          regio_platform: platformData.regio_platform,
          central_place: platformData.central_place,
          central_postcode: platformData.central_postcode,
          is_active: platformData.is_active ?? false
        }])
        .select()
        .single()
      
      if (error) {
        console.error("Error creating platform:", error)
        throw error
      }
      
      console.log("✅ Platform created successfully:", data)
      return data
    } catch (error) {
      console.error("Failed to create platform:", error)
      throw error
    }
  }

  // Get platform statistics (total, active, inactive counts)
  async getPlatformStats() {
    try {
      console.log("Getting platform statistics from platforms table...")
      
      const { data, error } = await this.serviceClient
        .from("platforms")
        .select("is_active")
        .not("regio_platform", "is", null)
        .not("regio_platform", "eq", "")
      
      if (error) {
        console.error("Error fetching platform stats:", error)
        throw error
      }
      
      const total = data.length
      const active = data.filter(platform => platform.is_active === true).length
      const inactive = total - active
      
      console.log(`📊 Platform stats: Total: ${total}, Active: ${active}, Inactive: ${inactive}`)
      
      return {
        total,
        active, 
        inactive
      }
    } catch (error) {
      console.error("Failed to get platform stats:", error)
      throw error
    }
  }

  // Get platform by name
  async getPlatformByName(name: string) {
    try {
      console.log("Getting platform by name:", name)
      
      const { data, error } = await this.serviceClient
        .from("platforms")
        .select("*")
        .eq("regio_platform", name)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
          console.log("Platform not found:", name)
          return null
        }
        console.error("Error fetching platform by name:", error)
        throw error
      }
      
      console.log("✅ Platform found:", data.id)
      return data
    } catch (error) {
      console.error("Failed to get platform by name:", error)
      throw error
    }
  }

  // Create a new region in the cities table
  async createRegion(regionData: {
    plaats: string
    postcode: string
    regio_platform: string
    platform_id?: string
    central_place?: string
    central_postcode?: string
    is_new_platform?: boolean
  }) {
    try {
      // Check for duplicate (plaats + postcode + regio_platform combination)
      const { data: existing, error: checkError } = await this.client
        .from("cities")
        .select("id")
        .eq("plaats", regionData.plaats)
        .eq("postcode", regionData.postcode)
        .eq("regio_platform", regionData.regio_platform)
        .maybeSingle()

      if (checkError) {
        console.error("Error checking for duplicates:", checkError)
        throw new Error("Failed to check for duplicate regions")
      }

      if (existing) {
        throw new Error("A region with this plaats, postcode, and platform combination already exists")
      }

      // Prepare the data for insertion
      const insertData: any = {
        plaats: regionData.plaats,
        postcode: regionData.postcode,
        regio_platform: regionData.regio_platform,
        platform_id: regionData.platform_id,
        is_active: false
      }

      // Log platform information for new platforms (for future reference/setup)
      if (regionData.is_new_platform && regionData.central_place && regionData.central_postcode) {
        console.log(`New platform created: ${regionData.regio_platform}`)
        console.log(`Central place: ${regionData.central_place}`)
        console.log(`Central postcode: ${regionData.central_postcode}`)
        console.log(`This information can be used for setting up job scraping for this platform`)
      }

      // Insert the new region
      const { data, error } = await this.client
        .from("cities")
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error("Error creating region:", error)
        throw new Error(error.message || "Failed to create region")
      }

      return data
    } catch (error) {
      console.error("Error in createRegion:", error)
      throw error
    }
  }
}

// Export singleton instance
export const supabaseService = new SupabaseService()
