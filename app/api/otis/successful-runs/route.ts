import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    console.log('Starting successful-runs API...')
    
    // Get query parameters
    const searchParams = req.nextUrl.searchParams
    const statusFilter = searchParams.get('status')
    
    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient()
    
    // Get successful Apify runs with rich data (platform names, city names, job counts)
    // Filter by specific actor IDs only - these are the OTIS scraper actor IDs
    const allowedActorIds = ['RIGGeqD6RqKmlVoQU', 'TrtlecxAsNRbKl1na']
    
    // First, get the basic apify_runs data without joins to avoid join failures
    let query = supabase
      .from('apify_runs')
      .select(`
        id,
        title,
        created_at,
        finished_at,
        actor_id,
        processing_status,
        processing_notes,
        processed_at,
        processed_by,
        source,
        region,
        platform_id,
        status
      `)
      .eq('status', 'SUCCEEDED')
      .in('actor_id', allowedActorIds)
    
    // Apply status filter if provided
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'not_started' || statusFilter === 'in_progress' || statusFilter === 'completed') {
        query = query.eq('processing_status', statusFilter)
      }
    }
    
    // Order by created_at descending (most recent first)
    query = query.order('created_at', { ascending: false })
    
    const { data: apifyRuns, error } = await query

    console.log('Query completed. Error:', error)
    console.log('Data length:', apifyRuns?.length || 0)

    if (error) {
      console.error('Error fetching successful Apify runs:', error)
      // Return the actual error for debugging
      return NextResponse.json({
        runs: [],
        count: 0,
        message: 'No scraping runs available',
        error: error.message,
        details: error
      })
    }

    // Get company and job posting counts for each run
    const runIds = (apifyRuns || []).map(run => run.id)
    console.log('Looking for company and job data for runs:', runIds.slice(0, 5)) // Show first 5 run IDs
    
    // Get all job postings for these runs (including company_id for counting unique companies)
    console.log('DEBUG: Looking for job postings for', runIds.length, 'runs, including:', runIds.slice(0, 5))
    
    // Use parallel queries to get both job counts and company counts more efficiently
    const jobPostingQueries = runIds.map(async (runId) => {
      // For each run, get job postings with companies
      const { data: jobData, error: jobError } = await supabase
        .from('job_postings')
        .select(`
          id,
          apify_run_id,
          companies!inner(id)
        `)
        .eq('apify_run_id', runId)
        
      if (jobError) {
        console.error(`Error fetching jobs for run ${runId}:`, jobError)
        return { runId, jobCount: 0, companyIds: [] }
      }
      
      // Count jobs and unique companies
      const jobCount = jobData?.length || 0
      const companyIds = [...new Set(jobData?.map(j => j.companies.id).filter(Boolean))] || []
      const companyCount = companyIds.length
      
      console.log(`Run ${runId}: ${jobCount} jobs, ${companyCount} companies`)
      return { runId, jobCount, companyCount, companyIds }
    })
    
    const jobPostingsResults = await Promise.all(jobPostingQueries)
    
    // Convert results to maps
    const jobCountMap = new Map()
    const companyCountMap = new Map()
    
    jobPostingsResults.forEach(({ runId, jobCount, companyCount }) => {
      jobCountMap.set(runId, jobCount)
      companyCountMap.set(runId, companyCount)
    })
    
    // Legacy approach - keeping for comparison
    const { data: jobPostingsData, error: jobPostingsError } = await supabase
      .from('job_postings')
      .select('apify_run_id, company_id, id')
      .in('apify_run_id', runIds)
      
    // Legacy query results for debugging/comparison
    console.log('Legacy Supabase query completed. Error:', jobPostingsError)
    console.log('Legacy query found:', jobPostingsData?.length || 0, 'job postings')

    // Transform data for frontend with Option B format: "Financial Controller (Indeed • Wassenaar) • 151 companies • Jul 25"
    const transformedRuns = (apifyRuns || []).map(run => {
      const title = run.title || `Run ${run.id.substring(0, 8)}`
      // Extract platform and city from the title or use the region field
      let platform = 'Unknown Platform'
      let city = run.region || 'Unknown City'
      
      // Try to parse platform from title (e.g., "LinkedIn - Amsterdam" or "Indeed - Rotterdam")
      if (run.title) {
        const parts = run.title.split(' - ')
        if (parts.length >= 2) {
          platform = parts[0].trim()
          city = parts[1]?.trim() || city
        }
      }
      const companyCount = companyCountMap.get(run.id) || 0
      const jobCount = jobCountMap.get(run.id) || 0
      console.log(`Assigning to run ${run.id} (${title}): ${companyCount} companies, ${jobCount} job postings`)
      
      // Format date for freshness (Jul 25, or Jul 25 10:12 if same day and time matters)
      const date = new Date(run.created_at)
      const today = new Date()
      const isToday = date.toDateString() === today.toDateString()
      const isRecent = (today.getTime() - date.getTime()) < (7 * 24 * 60 * 60 * 1000) // Within 7 days
      
      let dateDisplay
      if (isToday) {
        dateDisplay = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      } else if (isRecent) {
        dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
                    ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      } else {
        dateDisplay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      
      // Create compact display: "Financial Controller (Indeed • Wassenaar) • 25 jobs • 15 companies • Jul 25"
      const displayName = `${title} (${platform} • ${city}) • ${jobCount} jobs • ${companyCount} companies • ${dateDisplay}`
      
      return {
        id: run.id,
        title: title,
        platform: platform,
        location: city,
        companyCount: companyCount,
        jobCount: jobCount,
        regionPlatform: `${platform} • ${city}`,
        displayName: displayName,
        createdAt: run.created_at,
        finishedAt: run.finished_at,
        processing_status: run.processing_status || 'not_started',
        processing_notes: run.processing_notes || null,
        processed_at: run.processed_at || null,
        processed_by: run.processed_by || null
      }
    }).filter(run => run.id)

    console.log(`Found ${transformedRuns.length} successful Apify runs`)

    return NextResponse.json({
      runs: transformedRuns,
      count: transformedRuns.length
    })

  } catch (error) {
    console.error('Error in successful-runs API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 