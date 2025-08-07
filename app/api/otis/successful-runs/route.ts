import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    console.log('Starting successful-runs API...')
    
    // Use regular client 
    const supabase = createClient()
    
    // Get successful Apify runs with rich data (platform names, city names, job counts)
    // Filter by specific actor IDs only
    const allowedActorIds = ['TrtlecxAsNRbKl1na', '7ZuNFntlWSa1LO5uG', 'hMvNSpz3JnHgl5jkh']
    
    const { data: apifyRuns, error } = await supabase
      .from('apify_runs')
      .select(`
        id,
        title,
        created_at,
        finished_at,
        actor_id,
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
      .order('created_at', { ascending: false })
      .limit(20)

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

    // Get job counts for each run
    const runIds = (apifyRuns || []).map(run => run.id)
    const { data: jobCounts, error: jobCountError } = await supabase
      .from('job_postings')
      .select('apify_run_id')
      .in('apify_run_id', runIds)
    
    // Count jobs per run
    const jobCountMap = new Map()
    if (jobCounts && !jobCountError) {
      jobCounts.forEach(job => {
        const runId = job.apify_run_id
        jobCountMap.set(runId, (jobCountMap.get(runId) || 0) + 1)
      })
    }

    // Transform data for frontend with Option B format: "Financial Controller (Indeed • Wassenaar) • 151 jobs • Jul 25"
    const transformedRuns = (apifyRuns || []).map(run => {
      const title = run.title || `Run ${run.id.substring(0, 8)}`
      const platform = run.job_sources?.name || 'Unknown Platform'
      const city = run.regions?.plaats || 'Unknown City'
      const jobCount = jobCountMap.get(run.id) || 0
      
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
      
      // Create compact display: "Financial Controller (Indeed • Wassenaar) • 151 jobs • Jul 25"
      const displayName = `${title} (${platform} • ${city}) • ${jobCount} jobs • ${dateDisplay}`
      
      return {
        id: run.id,
        title: title,
        platform: platform,
        location: city,
        jobCount: jobCount,
        regionPlatform: `${platform} • ${city}`,
        displayName: displayName,
        createdAt: run.created_at,
        finishedAt: run.finished_at
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