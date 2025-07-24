import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    const supabase = createClient()
    
    console.log('Checking status for job:', jobId)

    // First, check if there's an apify run for this job
    const { data: apifyRun, error: apifyError } = await supabase
      .from('apify_runs')
      .select('*')
      .eq('session_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (apifyError && apifyError.code !== 'PGRST116') {
      console.error('Error fetching apify run:', apifyError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!apifyRun) {
      // No apify run found yet, return pending status
      return NextResponse.json({
        status: 'pending',
        jobId: jobId,
        jobCount: 0,
        companyCount: 0
      })
    }

    // Get job postings for this apify run
    const { data: jobPostings, error: jobsError } = await supabase
      .from('job_postings')
      .select('id, company_id')
      .eq('apify_run_id', apifyRun.id)

    if (jobsError) {
      console.error('Error fetching job postings:', jobsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Count unique companies
    const uniqueCompanies = new Set(jobPostings?.map(job => job.company_id).filter(Boolean) || [])
    const companyCount = uniqueCompanies.size
    const jobCount = jobPostings?.length || 0

    // Determine status based on apify run status
    let status = 'pending'
    if (apifyRun.status === 'SUCCEEDED') {
      status = 'completed'
    } else if (apifyRun.status === 'FAILED') {
      status = 'failed'
    } else if (apifyRun.status === 'RUNNING') {
      status = 'running'
    }

    return NextResponse.json({
      status: status,
      jobId: jobId,
      apifyRunId: apifyRun.id,
      jobCount: jobCount,
      companyCount: companyCount,
      completedAt: apifyRun.finished_at,
      createdAt: apifyRun.created_at
    })

  } catch (error) {
    console.error('Error in apify-runs API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 