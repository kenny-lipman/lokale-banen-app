import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(req: NextRequest) {
  try {
    console.log('Testing authentication setup...')
    
    // Test basic connection
    const { data: testData, error: testError } = await supabaseService.client
      .from('apify_runs')
      .select('count', { count: 'exact', head: true })
    
    if (testError) {
      console.error('❌ Connection test failed:', testError)
      return NextResponse.json({ 
        success: false, 
        error: 'Database connection failed',
        details: testError.message
      }, { status: 500 })
    }

    console.log('✅ Database connection successful')
    
    // Test successful runs query
    const { data: runs, error: runsError } = await supabaseService.client
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
      .limit(5)

    if (runsError) {
      console.error('❌ Runs query failed:', runsError)
      return NextResponse.json({ 
        success: false, 
        error: 'Runs query failed',
        details: runsError.message
      }, { status: 500 })
    }

    console.log(`✅ Found ${runs?.length || 0} successful runs`)

    return NextResponse.json({
      success: true,
      message: 'Authentication setup is working correctly',
      data: {
        connectionTest: 'passed',
        runsFound: runs?.length || 0,
        sampleRuns: runs?.slice(0, 2) || []
      }
    })

  } catch (error) {
    console.error('❌ Test failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 