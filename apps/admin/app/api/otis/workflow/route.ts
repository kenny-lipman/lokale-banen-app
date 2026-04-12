import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { OtisErrorHandler } from '@/lib/error-handler'

async function otisWorkflowHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const { action, data } = await req.json()
    const { supabase } = authResult
    
    console.log('Workflow API called with action:', action, 'data:', data)
    
    switch (action) {
      case 'create_session':
        return await handleCreateSession(data, supabase)
      case 'start_scraping':
        return await handleStartScraping(data, supabase)
      case 'start_enrichment':
        return await handleStartEnrichment(data, supabase)
      case 'create_campaign':
        return await handleCreateCampaign(data, supabase)
      case 'get_scraping_results':
        return await handleGetScrapingResults(data, supabase)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Workflow API error:', error)
    const handledError = OtisErrorHandler.handle(error, 'workflow_api')
    return NextResponse.json(handledError, { status: 500 })
  }
}

async function handleCreateSession(data: any, supabase: any) {
  const { stage } = data
  
  try {
    // Generate a unique session ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('Creating session:', sessionId, 'with stage:', stage)

    // Insert session into database
    const { data: sessionData, error: sessionError } = await supabase
      .from('otis_workflow_sessions')
      .insert({
        session_id: sessionId,
        current_stage: stage || 'scraping',
        status: 'active'
      })
      .select()
      .single()

    if (sessionError) {
      console.error('Error creating session in database:', sessionError)
      throw new Error('Failed to create session in database')
    }

    console.log('Session created successfully:', sessionData)

    return NextResponse.json({ 
      success: true, 
      message: 'Session created',
      sessionId: sessionId,
      session: sessionData
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create session',
      details: error.message
    }, { status: 500 })
  }
}

async function handleStartScraping(data: any, supabase: any) {
  const { location, jobTitle, platform, selectedRegioPlatforms, webhookUrl } = data
  
  let finalLocation = location
  
  // If location is not provided but we have selectedRegioPlatforms, try to resolve location from central places
  if (!finalLocation && selectedRegioPlatforms && selectedRegioPlatforms.length > 0) {
    try {
      // Query central places for the selected regio platforms
      const { data: centralPlaces, error: centralPlacesError } = await supabase
        .from('regio_platform_central_places')
        .select('regio_platform, central_place')
        .in('regio_platform', selectedRegioPlatforms)
        .eq('is_active', true)
        .limit(1)
        .single()
      
      if (!centralPlacesError && centralPlaces) {
        finalLocation = centralPlaces.central_place
        console.log(`Resolved location from central places: ${selectedRegioPlatforms[0]} -> ${finalLocation}`)
      }
    } catch (error) {
      console.log('Could not resolve location from central places:', error)
    }
  }
  
  if (!finalLocation) {
    throw new Error('Location is required')
  }
  
  try {
    // Create a simple job ID for tracking
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('Starting scraping job:', jobId, 'for:', jobTitle, 'in:', finalLocation)

    // Use the webhook URL from the database or fallback to default
    const finalWebhookUrl = webhookUrl || "https://ba.grive-dev.com/webhook/ddb2acdd-5cb7-4a4a-b0e7-30bc4abc7015"
    
    // Trigger Apify webhook with simplified payload
    const webhookResponse = await fetch(finalWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locatie: selectedRegioPlatforms && selectedRegioPlatforms.length > 0 ? selectedRegioPlatforms[0] : finalLocation,
        plaats: finalLocation,
        functie: jobTitle || '', // Make job title optional
        platform: platform,
        session_id: jobId, // Use jobId as session_id for tracking
        selectedRegioPlatforms: selectedRegioPlatforms || []
      }),
    })

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed: ${webhookResponse.status}`)
    }

    const webhookResult = await webhookResponse.json()
    console.log('Webhook triggered successfully:', webhookResult)

    return NextResponse.json({ 
      success: true, 
      message: 'Scraping started',
      jobId: jobId,
      webhookResult
    })
  } catch (error) {
    console.error('Error starting scraping:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to start scraping',
      details: error.message
    }, { status: 500 })
  }
}

async function handleStartEnrichment(data: any, supabase: any) {
  const { jobId, companies } = data
  
  if (!jobId || !companies || companies.length === 0) {
    throw new Error('Job ID and companies are required')
  }
  
  try {
    console.log('Starting enrichment for job:', jobId, 'with', companies.length, 'companies')

    // TODO: Trigger Apollo enrichment
    // This would integrate with your existing Apollo setup
    // For now, just log the enrichment request

    return NextResponse.json({ 
      success: true, 
      message: 'Enrichment started',
      jobId
    })
  } catch (error) {
    console.error('Error starting enrichment:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to start enrichment'
    }, { status: 500 })
  }
}

async function handleCreateCampaign(data: any, supabase: any) {
  const { jobId, contacts, campaignName, emailSubject, emailBody } = data
  
  if (!jobId || !campaignName || !emailSubject || !emailBody) {
    throw new Error('Job ID, campaign name, email subject, and email body are required')
  }
  
  try {
    console.log('Creating campaign for job:', jobId, 'with', contacts?.length || 0, 'contacts')

    // TODO: Trigger Instantly campaign creation
    // This would integrate with your existing Instantly setup
    // For now, just log the campaign creation request

    return NextResponse.json({ 
      success: true, 
      message: 'Campaign created',
      jobId
    })
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create campaign'
    }, { status: 500 })
  }
}





async function handleGetScrapingResults(data: any, supabase: any) {
  const { jobId } = data
  
  if (!jobId) {
    throw new Error('Job ID is required')
  }
  
  try {
    // Find the apify run for this job
    const { data: apifyRun, error: runError } = await supabase
      .from('apify_runs')
      .select('id, status, created_at, finished_at')
      .eq('session_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (runError) {
      console.log('No apify run found for job:', jobId)
      return NextResponse.json({
        success: true,
        data: {
          status: 'pending',
          job_count: 0,
          companies: []
        }
      })
    }

    const apifyRunId = apifyRun.id
    console.log(`Fetching data for apify_run_id: ${apifyRunId}`)

    // Enhanced query: Get job postings with complete company data
    let { data: jobPostings, error: jobsError } = await supabase
      .from('job_postings')
      .select(`
        id, 
        title, 
        company_id, 
        location, 
        created_at,
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
          normalized_name
        )
      `)
      .eq('apify_run_id', apifyRunId)
      .order('created_at', { ascending: false })

    if (jobsError) throw jobsError

    // If no job postings found, check if there are any recent job postings that might belong to this session
    if (!jobPostings || jobPostings.length === 0) {
      console.log('No job postings found for apify_run_id, checking for recent posts...')
      
      // Look for recent job postings that might be from this scraping session
      const { data: recentJobs, error: recentJobsError } = await supabase
        .from('job_postings')
        .select(`
          id, 
          title, 
          company_id, 
          location, 
          created_at,
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
            normalized_name
          )
        `)
        .is('apify_run_id', null) // Job postings without apify_run_id
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
        .order('created_at', { ascending: false })
        .limit(20)

      if (!recentJobsError && recentJobs && recentJobs.length > 0) {
        console.log(`Found ${recentJobs.length} recent job postings without apify_run_id`)
        // Update these job postings with the apify_run_id
        const { error: updateError } = await supabase
          .from('job_postings')
          .update({ apify_run_id: apifyRunId })
          .in('id', recentJobs.map(job => job.id))

        if (updateError) {
          console.error('Error updating job postings with apify_run_id:', updateError)
        } else {
          console.log('Updated job postings with apify_run_id')
          // Use the updated job postings
          jobPostings = recentJobs
        }
      }
    }

    // Enhanced company aggregation with complete data
    const companiesMap = new Map()
    const jobCounts = new Map()
    const jobDetails = new Map() // Store job details for each company
    
    jobPostings?.forEach(job => {
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
          salary: job.salary,
          job_type: job.job_type,
          url: job.url,
          created_at: job.created_at
        })
        
        if (!companiesMap.has(companyId)) {
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
            enrichment_status: 'pending', // Default enrichment status
            contactsFound: 0, // Default contacts count
            created_at: job.companies.created_at,
            job_postings: [] // Will be populated below
          })
        }
      }
    })

    // Update job counts and add job details for all companies
    companiesMap.forEach((company, companyId) => {
      company.job_count = jobCounts.get(companyId) || 1
      company.job_postings = jobDetails.get(companyId) || []
    })

    const companies = Array.from(companiesMap.values())

    console.log(`Found ${companies.length} companies with ${jobPostings?.length || 0} job postings for apify_run_id: ${apifyRunId}`)

    return NextResponse.json({
      success: true,
      data: {
        status: apifyRun.status || 'completed',
        job_count: jobPostings?.length || 0,
        companies: companies,
        apify_run_id: apifyRunId,
        completed_at: apifyRun.finished_at
      }
    })

  } catch (error) {
    console.error('Error getting scraping results:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get scraping results',
      details: error.message
    }, { status: 500 })
  }
}

export const POST = withAuth(otisWorkflowHandler)


