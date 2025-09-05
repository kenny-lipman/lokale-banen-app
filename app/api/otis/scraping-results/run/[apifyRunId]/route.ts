import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ apifyRunId: string }> }
) {
  const { apifyRunId } = await params

  if (!apifyRunId) {
    return NextResponse.json(
      { success: false, error: 'Apify Run ID is required' },
      { status: 400 }
    )
  }

  try {
    const supabase = createServiceRoleClient()
    console.log(`Fetching complete data for apify_run_id: ${apifyRunId}`)

    // Get all job postings for this apify run with complete company data
    const { data: jobPostings, error: jobsError } = await supabase
      .from('job_postings')
      .select(`
        id, 
        title, 
        company_id, 
        location, 
        created_at,
        status,
        review_status,
        url,
        description,
        job_type,
        salary,
        country,
                  companies(
            id, 
            name, 
            website, 
            location, 
            is_customer, 
            source, 
            status, 
            category_size,
            size_min,
            size_max,
            description,
            indeed_url,
            logo_url,
            review_count_indeed,
            rating_indeed,
            normalized_name,
            enrichment_status,
            created_at,
            qualification_status,
            qualification_timestamp,
            qualification_notes
          )
      `)
      .eq('apify_run_id', apifyRunId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      console.error('Error fetching job postings:', jobsError)
      throw jobsError
    }

    // Get apify run details
    const { data: apifyRun, error: runError } = await supabase
      .from('apify_runs')
      .select('*')
      .eq('id', apifyRunId)
      .single()

    if (runError && runError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching apify run:', runError)
    }

    // Enhanced company aggregation with complete data
    const companiesMap = new Map()
    const jobCounts = new Map()
    const jobDetails = new Map()
    
    // Get contact counts for all companies - limit to prevent fetch errors
    const allCompanyIds = jobPostings?.map(job => job.companies?.id).filter(Boolean) || []
    const companyIds = allCompanyIds.slice(0, 100) // Limit to 100 companies to prevent fetch errors
    console.log(`Getting contact counts for ${companyIds.length} companies (limited from ${allCompanyIds.length})`)
    
    const { data: contactCounts, error: contactError } = await supabase
      .from('contacts')
      .select('company_id')
      .in('company_id', companyIds)
      .not('company_id', 'is', null)

    if (contactError) {
      console.error('Error fetching contact counts:', contactError)
    }

    // Calculate contact counts per company
    const contactCountMap = new Map<string, number>()
    contactCounts?.forEach(contact => {
      const companyId = contact.company_id
      contactCountMap.set(companyId, (contactCountMap.get(companyId) || 0) + 1)
    })
    
    jobPostings?.forEach((job: any) => {
      if (job.companies) {
        const companyId = job.companies.id
        
        // Count jobs per company
        jobCounts.set(companyId, (jobCounts.get(companyId) || 0) + 1)
        
        // Store job details for this company
        if (!jobDetails.has(companyId)) {
          jobDetails.set(companyId, [])
        }
        jobDetails.get(companyId).push({
          id: job.id,
          title: job.title,
          location: job.location,
          status: job.status,
          url: job.url,
          created_at: job.created_at
        })
        
        if (!companiesMap.has(companyId)) {
          const contactCount = contactCountMap.get(companyId) || 0
          const isEnriched = contactCount > 0
          
          companiesMap.set(companyId, {
            id: companyId,
            name: job.companies.name,
            website: job.companies.website,
            location: job.companies.location,
            is_customer: job.companies.is_customer,
            source: job.companies.source,
            status: job.companies.status,
            category_size: job.companies.category_size,
            size_min: job.companies.size_min,
            size_max: job.companies.size_max,
            description: job.companies.description,
            indeed_url: job.companies.indeed_url,
            logo_url: job.companies.logo_url,
            review_count_indeed: job.companies.review_count_indeed,
            rating_indeed: job.companies.rating_indeed,
            normalized_name: job.companies.normalized_name,
            job_count: 1,
            enrichment_status: job.companies.enrichment_status || 'pending', // Use actual value from database
            contactsFound: contactCount, // Actual contact count
            created_at: job.companies.created_at,
            // Include qualification fields from database
            qualification_status: job.companies.qualification_status || 'pending',
            qualification_timestamp: job.companies.qualification_timestamp,
            qualification_notes: job.companies.qualification_notes,
            jobs: [] // Will be populated below
          })
        }
      }
    })

    // Update job counts and add job details for all companies
    companiesMap.forEach((company, companyId) => {
      company.job_count = jobCounts.get(companyId) || 1
      company.jobs = jobDetails.get(companyId) || []
    })

    const companies = Array.from(companiesMap.values())

    console.log(`Found ${companies.length} companies with ${jobPostings?.length || 0} job postings for apify_run_id: ${apifyRunId}`)

    return NextResponse.json({
      success: true,
      data: {
        apify_run_id: apifyRunId,
        apify_run: apifyRun,
        status: apifyRun?.status || 'completed',
        job_count: jobPostings?.length || 0,
        companies: companies,
        total_companies: companies.length,
        created_at: apifyRun?.created_at,
        completed_at: apifyRun?.finished_at
      }
    })

  } catch (error: any) {
    console.error('Error getting scraping results by apify_run_id:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get scraping results',
      details: error.message
    }, { status: 500 })
  }
} 