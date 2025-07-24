import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(req: NextRequest) {
  try {
    console.log('Starting successful-runs API...')
    
    console.log('Fetching successful Apify runs...')

    // Get successful Apify runs with correct column names and join with regions and job_sources tables
    const { data: apifyRuns, error } = await supabaseService.client
      .from('apify_runs')
      .select(`
        id,
        title,
        region_id,
        source,
        created_at,
        finished_at,
        regions(plaats),
        job_sources!inner(name)
      `)
      .eq('status', 'SUCCEEDED')
      .eq('actor_id', 'hMvNSpz3JnHgl5jkh')
      .order('created_at', { ascending: false })

    console.log('Query completed. Error:', error)
    console.log('Data length:', apifyRuns?.length || 0)

    if (error) {
      console.error('Error fetching successful Apify runs:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Transform data for frontend - show 'title - regio_id.plaats' format
    const transformedRuns = (apifyRuns || []).map(run => {
      const title = run.title || 'Untitled Run'
      const plaats = run.regions?.plaats || 'Unknown Location'
      const platform = run.job_sources?.name || 'Unknown Platform'
      
      return {
        id: run.id,
        title: title,
        platform: platform,
        location: plaats,
        regionPlatform: platform, // For backward compatibility
        displayName: `${title} - ${plaats}`,
        createdAt: run.created_at,
        finishedAt: run.finished_at
      }
    }).filter(run => run.title !== 'Untitled Run' && run.location !== 'Unknown Location')

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