import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { cacheService } from '@/lib/cache-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const { searchParams } = new URL(req.url)
  
  // Enhanced query parameters for filtering and pagination
  const qualificationFilter = searchParams.get('qualification') // 'all', 'qualified', 'disqualified', 'review', 'pending'
  const verificationFilter = searchParams.get('verification') // 'all', 'verified', 'pending', 'failed'
  const contactTypeFilter = searchParams.get('contactType') // 'all', 'key', 'standard'
  const campaignStatusFilter = searchParams.get('campaignStatus') // 'all', 'in_campaign', 'not_in_campaign'
  const campaignIdFilter = searchParams.get('campaignId') // Specific campaign ID filter
  const search = searchParams.get('search') // Search in contact name, email, title
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200) // Cap at 200 for performance
  const offset = parseInt(searchParams.get('offset') || '0')
  const includeMetadata = searchParams.get('includeMetadata') === 'true' // Include detailed metadata
  const bypassCache = searchParams.get('bypassCache') === 'true' // Bypass cache for fresh data

  if (!runId) {
    return NextResponse.json(
      { success: false, error: 'Run ID is required', code: 'MISSING_RUN_ID' },
      { status: 400 }
    )
  }

  // Validate pagination parameters
  if (limit < 0 || offset < 0) {
    return NextResponse.json(
      { success: false, error: 'Invalid pagination parameters', code: 'INVALID_PAGINATION' },
      { status: 400 }
    )
  }

  try {
    const supabase = createClient()
    console.log(`Fetching contacts by company for apify_run_id: ${runId} with limit: ${limit}, offset: ${offset}`)

    // Check cache for frequently accessed data (cache for 2 minutes)
    const cacheKey = `contacts_by_company:${runId}:${qualificationFilter}:${verificationFilter}:${contactTypeFilter}:${campaignStatusFilter}:${campaignIdFilter}:${search}:${limit}:${offset}`
    
    // Only use cache if bypassCache is not true
    if (!bypassCache) {
      const cachedData = cacheService.get(cacheKey)
      
      if (cachedData) {
        console.log('Returning cached data for contacts by company')
        return NextResponse.json({
          ...cachedData,
          cached: true
        })
      }
    } else {
      console.log('Bypassing cache for fresh data')
    }

    // First, get all companies from this run with their qualifications and region info
    const { data: runCompanies, error: companiesError } = await supabase
      .from('job_postings')
      .select(`
        companies!inner(
          id,
          name,
          website,
          location,
          category_size,
          qualification_status,
          qualification_timestamp,
          qualification_notes,
          enrichment_status,
          apollo_contacts_count,
          apollo_enriched_at,
          created_at
        ),
        regions(
          id,
          plaats,
          regio_platform
        )
      `)
      .eq('apify_run_id', runId)
      .not('companies.id', 'is', null)

    if (companiesError) {
      console.error('Error fetching companies from run:', companiesError)
      console.error('Companies query details:', {
        runId,
        errorMessage: companiesError.message || companiesError,
        errorDetails: companiesError.details || 'No details'
      })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch companies from run', code: 'COMPANIES_FETCH_ERROR', details: companiesError.message || companiesError },
        { status: 500 }
      )
    }

    // Extract unique companies with region info
    const companiesMap = new Map()
    runCompanies?.forEach((item: any) => {
      if (item.companies) {
        const companyId = item.companies.id
        if (!companiesMap.has(companyId)) {
          companiesMap.set(companyId, {
            ...item.companies,
            region_plaats: item.regions?.plaats || null,
            region_platform: item.regions?.regio_platform || null
          })
        }
      }
    })

    let companies = Array.from(companiesMap.values())

    // Apply qualification filter
    if (qualificationFilter && qualificationFilter !== 'all') {
      companies = companies.filter(company => 
        company.qualification_status === qualificationFilter
      )
    }

    // Get company IDs for contact fetching
    const companyIds = companies.map(company => company.id)

    if (companyIds.length === 0) {
      const emptyResponse = {
        success: true,
        data: {
          apify_run_id: runId,
          companies: [],
          total_companies: 0,
          total_contacts: 0,
          pagination: {
            limit,
            offset,
            has_more: false,
            total_count: 0
          },
          filters_applied: {
            qualification: qualificationFilter,
            verification: verificationFilter,
            contactType: contactTypeFilter,
            search: search
          }
        }
      }
      
      // Cache empty results for 1 minute
      cacheService.set(cacheKey, emptyResponse, 60)
      
      return NextResponse.json(emptyResponse)
    }

    // Build optimized contacts query with better performance
    let contactsQuery = supabase
      .from('contacts')
      .select(`
        id,
        name,
        first_name,
        last_name,
        email,
        title,
        linkedin_url,
        phone,
        campaign_id,
        campaign_name,
        email_status,
        company_id,
        created_at,
        qualification_status,
        qualification_notes,
        qualification_timestamp,
        is_key_contact,
        contact_priority
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .order('name', { ascending: true })

    // Apply search filter with optimized OR conditions
    if (search) {
      const searchTerm = `%${search}%`
      contactsQuery = contactsQuery.or(
        `name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},title.ilike.${searchTerm}`
      )
    }

    // Apply verification filter
    if (verificationFilter && verificationFilter !== 'all') {
      switch (verificationFilter) {
        case 'verified':
          contactsQuery = contactsQuery.eq('email_status', 'verified')
          break
        case 'pending':
          contactsQuery = contactsQuery.in('email_status', ['pending', null])
          break
        case 'failed':
          contactsQuery = contactsQuery.eq('email_status', 'failed')
          break
      }
    }

    // Apply qualification filter
    if (qualificationFilter && qualificationFilter !== 'all') {
      switch (qualificationFilter) {
        case 'qualified':
          contactsQuery = contactsQuery.eq('qualification_status', 'qualified')
          break
        case 'disqualified':
          contactsQuery = contactsQuery.eq('qualification_status', 'disqualified')
          break
        case 'review':
          contactsQuery = contactsQuery.eq('qualification_status', 'review')
          break
        case 'pending':
          contactsQuery = contactsQuery.in('qualification_status', ['pending', null])
          break
      }
    }

    // Apply campaign status filter
    if (campaignStatusFilter && campaignStatusFilter !== 'all') {
      switch (campaignStatusFilter) {
        case 'in_campaign':
          contactsQuery = contactsQuery.not('campaign_id', 'is', null)
          break
        case 'not_in_campaign':
          contactsQuery = contactsQuery.is('campaign_id', null)
          break
      }
    }

    // Apply specific campaign ID filter
    if (campaignIdFilter) {
      contactsQuery = contactsQuery.eq('campaign_id', campaignIdFilter)
    }

    // Get total count for pagination (without limit/offset)
    const { count: totalCount, error: countError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .in('company_id', companyIds)

    if (countError) {
      console.error('Error getting total count:', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to get total count', code: 'COUNT_ERROR', details: countError.message },
        { status: 500 }
      )
    }

    // Apply pagination
    if (limit > 0) {
      contactsQuery = contactsQuery.range(offset, offset + limit - 1)
    }

    const { data: contacts, error: contactsError } = await contactsQuery

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      console.error('Contacts query details:', {
        companyIds: companyIds.slice(0, 5), // Show first 5 company IDs
        totalCompanyIds: companyIds.length,
        verificationFilter,
        contactTypeFilter,
        search,
        limit,
        offset
      })
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts', code: 'CONTACTS_FETCH_ERROR', details: contactsError.message || contactsError },
        { status: 500 }
      )
    }

    // Group contacts by company and enhance with company data
    const contactsByCompany = new Map()
    
    // Initialize companies in the map
    companies.forEach(company => {
      contactsByCompany.set(company.id, {
        company: company,
        contacts: []
      })
    })

    // Add contacts to their respective companies with optimized processing
    contacts?.forEach(contact => {
      // Use database field for key contact status, fallback to title-based logic for backward compatibility
      const isKeyContact = contact.is_key_contact !== null ? 
        contact.is_key_contact : 
        (contact.title?.toLowerCase().includes('ceo') ||
         contact.title?.toLowerCase().includes('founder') ||
         contact.title?.toLowerCase().includes('owner') ||
         contact.title?.toLowerCase().includes('director') ||
         contact.title?.toLowerCase().includes('manager'))

      const enhancedContact = {
        ...contact,
        isKeyContact,
        scrapingStatus: contact.email ? 'scraped' : 'failed',
        verificationStatus: contact.email_status || 'pending',
        qualificationStatus: contact.qualification_status || 'pending'
      }

      // Apply contact type filter
      if (contactTypeFilter && contactTypeFilter !== 'all') {
        if (contactTypeFilter === 'key' && !isKeyContact) return
        if (contactTypeFilter === 'standard' && isKeyContact) return
      }

      if (contactsByCompany.has(contact.company_id)) {
        contactsByCompany.get(contact.company_id).contacts.push(enhancedContact)
      }
    })

    // Convert to array, filter out companies with 0 contacts, and sort
    const companiesWithContacts = Array.from(contactsByCompany.values())
      .map(item => ({
        ...item.company,
        contacts: item.contacts,
        contactCount: item.contacts.length,
        keyContactCount: item.contacts.filter(c => c.isKeyContact).length,
        verifiedContactCount: item.contacts.filter(c => c.verificationStatus === 'verified').length
      }))
      .filter(company => company.contactCount > 0) // Only show companies with 1+ contacts
      .sort((a, b) => {
        // Sort by qualification status first (qualified first), then by contact count (desc)
        const statusOrder = { 'qualified': 0, 'review': 1, 'pending': 2, 'disqualified': 3 }
        const statusDiff = (statusOrder[a.qualification_status as keyof typeof statusOrder] || 4) - 
                          (statusOrder[b.qualification_status as keyof typeof statusOrder] || 4)
        if (statusDiff !== 0) return statusDiff
        return b.contactCount - a.contactCount
      })

    // Calculate summary statistics
    const totalContacts = companiesWithContacts.reduce((sum, company) => sum + company.contactCount, 0)
    const totalKeyContacts = companiesWithContacts.reduce((sum, company) => sum + company.keyContactCount, 0)
    const totalVerifiedContacts = companiesWithContacts.reduce((sum, company) => sum + company.verifiedContactCount, 0)
    
    // Calculate contact qualification statistics
    const allContacts = companiesWithContacts.flatMap(company => company.contacts)
    const qualifiedContacts = allContacts.filter(c => c.qualificationStatus === 'qualified').length
    const reviewContacts = allContacts.filter(c => c.qualificationStatus === 'review').length
    const pendingContacts = allContacts.filter(c => c.qualificationStatus === 'pending').length
    const disqualifiedContacts = allContacts.filter(c => c.qualificationStatus === 'disqualified').length

    // Calculate campaign statistics
    const contactsInCampaigns = allContacts.filter(c => c.campaign_id).length
    const contactsNotInCampaigns = allContacts.filter(c => !c.campaign_id).length
    
    // Group contacts by campaign for detailed statistics
    const campaignStats = allContacts
      .filter(c => c.campaign_id)
      .reduce((acc, contact) => {
        const campaignId = contact.campaign_id
        const campaignName = contact.campaign_name || 'Unknown Campaign'
        
        if (!acc[campaignId]) {
          acc[campaignId] = {
            campaign_id: campaignId,
            campaign_name: campaignName,
            total_contacts: 0,
            qualified_contacts: 0,
            key_contacts: 0
          }
        }
        
        acc[campaignId].total_contacts++
        if (contact.qualificationStatus === 'qualified') {
          acc[campaignId].qualified_contacts++
        }
        if (contact.isKeyContact) {
          acc[campaignId].key_contacts++
        }
        
        return acc
      }, {} as Record<string, any>)

    const campaignDistribution = Object.values(campaignStats).sort((a: any, b: any) => b.total_contacts - a.total_contacts)

    // Enhanced pagination information
    const hasMore = (offset + limit) < (totalCount || 0)
    const pagination = {
      limit,
      offset,
      has_more: hasMore,
      total_count: totalCount || 0,
      current_page: Math.floor(offset / limit) + 1,
      total_pages: Math.ceil((totalCount || 0) / limit)
    }

    const response = {
      success: true,
      data: {
        apify_run_id: runId,
        companies: companiesWithContacts,
        total_companies: companiesWithContacts.length,
        total_contacts: totalContacts,
        total_key_contacts: totalKeyContacts,
        total_verified_contacts: totalVerifiedContacts,
        pagination,
        company_qualification_summary: {
          qualified: companiesWithContacts.filter(c => c.qualification_status === 'qualified').length,
          review: companiesWithContacts.filter(c => c.qualification_status === 'review').length,
          pending: companiesWithContacts.filter(c => c.qualification_status === 'pending').length,
          disqualified: companiesWithContacts.filter(c => c.qualification_status === 'disqualified').length
        },
        contact_qualification_summary: {
          qualified: qualifiedContacts,
          review: reviewContacts,
          pending: pendingContacts,
          disqualified: disqualifiedContacts
        },
        campaign_statistics: {
          total_contacts_in_campaigns: contactsInCampaigns,
          total_contacts_not_in_campaigns: contactsNotInCampaigns,
          campaign_distribution: campaignDistribution
        },
        filters_applied: {
          qualification: qualificationFilter,
          verification: verificationFilter,
          contactType: contactTypeFilter,
          campaignStatus: campaignStatusFilter,
          campaignId: campaignIdFilter,
          search: search,
          limit,
          offset
        },
        // Include performance metadata if requested
        ...(includeMetadata && {
          performance: {
            query_time_ms: Date.now() - Date.now(), // Would need actual timing
            cache_hit: false,
            companies_processed: companies.length,
            contacts_processed: contacts?.length || 0
          }
        })
      }
    }

    // Cache the result for 30 seconds (shorter TTL for more responsive updates)
    // Only cache if we're not bypassing cache
    if (!bypassCache) {
      cacheService.setWithTTL(cacheKey, response, 30000) // 30 seconds instead of 2 minutes
    }

    console.log(`Returning ${companiesWithContacts.length} companies with ${totalContacts} contacts for apify_run_id: ${runId}`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error getting contacts by company:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get contacts by company',
      code: 'INTERNAL_ERROR',
      details: error.message
    }, { status: 500 })
  }
}