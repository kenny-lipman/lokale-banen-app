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
    // Filter by specific actor IDs only
    const allowedActorIds = ['TrtlecxAsNRbKl1na', '7ZuNFntlWSa1LO5uG', 'hMvNSpz3JnHgl5jkh']
    
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
        job_sources:source (
          name
        ),
        regions:region_id (
          plaats,
          regio_platform
        )
      `)
      .eq('status', 'SUCCEEDED')
      .in('actor_id', allowedActorIds)
    
    // Apply status filter if provided
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'not_started' || statusFilter === 'in_progress' || statusFilter === 'completed') {
        query = query.eq('processing_status', statusFilter)
      }
    }
    
    // Order and limit
    query = query.order('created_at', { ascending: false }).limit(50)
    
    const { data: apifyRuns, error } = await query

    console.log('Query completed. Error:', error)
    console.log('Data length:', apifyRuns?.length || 0)

    if (error) {
      console.error('Error fetching successful Apify runs:', error)
      // Return empty data instead of failing
      return NextResponse.json({
        runs: [],
        count: 0,
        message: 'No scraping runs available'
      })
    }

    // Get company counts for each run
    const runIds = (apifyRuns || []).map(run => run.id)
    console.log('Looking for company data for runs:', runIds.slice(0, 5)) // Show first 5 run IDs
    
    const { data: companyData, error: companyCountError } = await supabase
      .from('job_postings')
      .select('apify_run_id, company_id')
      .in('apify_run_id', runIds)
      .not('company_id', 'is', null)
      
    console.log('Supabase query completed. Error:', companyCountError)
    console.log('Query was for run IDs:', runIds.length, 'runs')
    
    if (companyCountError) {
      console.error('Supabase query error details:', companyCountError)
    }
    
    // Count unique companies per run
    const companyCountMap = new Map()
    if (companyData && !companyCountError) {
      console.log('Company data retrieved:', companyData.length, 'records')
      
      // Log specific data for the problematic run
      const targetRunData = companyData.filter(job => job.apify_run_id === 'E7P3IvTrK229btaOc')
      console.log(`Data for E7P3IvTrK229btaOc:`, targetRunData.length, 'job_postings')
      
      // Also check what data we DO have for this run (including NULL company_ids)
      console.log('Checking ALL job_postings for E7P3IvTrK229btaOc...')
      const { data: allJobsForRun, error: allJobsError } = await supabase
        .from('job_postings')
        .select('id, apify_run_id, company_id, title')
        .eq('apify_run_id', 'E7P3IvTrK229btaOc')
        .limit(10)
      
      console.log('Direct query result:', { 
        data: allJobsForRun?.length || 0, 
        error: allJobsError 
      })
      
      if (!allJobsError && allJobsForRun) {
        console.log(`Found ${allJobsForRun.length} total job_postings for E7P3IvTrK229btaOc:`)
        allJobsForRun.slice(0, 3).forEach(job => {
          console.log(`- Job ${job.id}: company_id = ${job.company_id}`)
        })
      } else if (allJobsError) {
        console.error('Error fetching all jobs for run:', allJobsError)
        console.error('Full error object:', JSON.stringify(allJobsError))
      }
      
      // Also test the exact same query we use for company counting
      console.log('Testing the exact company count query for this run...')
      const { data: testCompanyData, error: testError } = await supabase
        .from('job_postings')
        .select('apify_run_id, company_id')
        .eq('apify_run_id', 'E7P3IvTrK229btaOc')
        .not('company_id', 'is', null)
        .limit(5)
        
      console.log('Company count query result:', {
        found: testCompanyData?.length || 0,
        error: testError
      })
      
      if (testCompanyData && testCompanyData.length > 0) {
        console.log('Sample company IDs:', testCompanyData.slice(0, 3).map(d => d.company_id))
      }
      
      // Group by run_id and count unique company_ids
      const companiesByRun = new Map()
      companyData.forEach(job => {
        const runId = job.apify_run_id
        if (!companiesByRun.has(runId)) {
          companiesByRun.set(runId, new Set())
        }
        companiesByRun.get(runId).add(job.company_id)
      })
      
      // Convert to count map
      companiesByRun.forEach((companySet, runId) => {
        const count = companySet.size
        companyCountMap.set(runId, count)
        if (runId === 'E7P3IvTrK229btaOc') {
          console.log(`DEBUG: Run ${runId} has ${companySet.size} unique companies from Set:`, Array.from(companySet).slice(0, 5))
        }
      })
    } else if (companyCountError) {
      console.error('Error fetching company data:', companyCountError)
    } else {
      console.log('No company data returned')
    }

    // Transform data for frontend with Option B format: "Financial Controller (Indeed • Wassenaar) • 151 companies • Jul 25"
    const transformedRuns = (apifyRuns || []).map(run => {
      const title = run.title || `Run ${run.id.substring(0, 8)}`
      const platform = run.job_sources?.name || 'Unknown Platform'
      const city = run.regions?.plaats || 'Unknown City'
      const companyCount = companyCountMap.get(run.id) || 0
      console.log(`Assigning to run ${run.id} (${title}): ${companyCount} companies`)
      
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
      
      // Create compact display: "Financial Controller (Indeed • Wassenaar) • 151 companies • Jul 25"
      const displayName = `${title} (${platform} • ${city}) • ${companyCount} companies • ${dateDisplay}`
      
      return {
        id: run.id,
        title: title,
        platform: platform,
        location: city,
        companyCount: companyCount,
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