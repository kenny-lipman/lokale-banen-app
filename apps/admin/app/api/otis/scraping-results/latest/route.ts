import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function latestScrapingResultsHandler(request: NextRequest, authResult: AuthResult) {
  try {
    const supabase = authResult.supabase
    
    // Get the latest scraping job
    const { data: latestJob, error: jobError } = await supabase
      .from('scraping_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (jobError || !latestJob) {
      return NextResponse.json({ 
        error: 'No scraping jobs found' 
      }, { status: 404 })
    }

    // Get the detailed results for this job
    const { data: detailedResults, error: resultsError } = await supabase
      .from('scraping_results')
      .select('*')
      .eq('job_id', latestJob.id)
      .single()

    if (resultsError || !detailedResults) {
      return NextResponse.json({ 
        error: 'No detailed results found for latest job' 
      }, { status: 404 })
    }

    // Parse the detailed results
    let parsedResults
    try {
      parsedResults = typeof detailedResults.detailed_results === 'string' 
        ? JSON.parse(detailedResults.detailed_results)
        : detailedResults.detailed_results
    } catch (parseError) {
      return NextResponse.json({ 
        error: 'Failed to parse detailed results' 
      }, { status: 500 })
    }

    // Get companies with their contact counts
    const companies = parsedResults.companies || []
    
    // Get contact counts for each company
    const { data: contactCounts, error: contactError } = await supabase
      .from('contacts')
      .select('company_id, count')
      .in('company_id', companies.map((c: any) => c.id))
      .group('company_id')

    if (!contactError && contactCounts) {
      const countMap = new Map(contactCounts.map((item: any) => [item.company_id, parseInt(item.count)]))
      companies.forEach((company: any) => {
        company.contactsFound = countMap.get(company.id) || 0
      })
    }

    return NextResponse.json({
      job: latestJob,
      companies: companies,
      jobs: parsedResults.jobs || [],
      totalCompanies: companies.length,
      totalJobs: parsedResults.jobs?.length || 0
    })

  } catch (error) {
    console.error('Error fetching latest scraping results:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export const GET = withAuth(latestScrapingResultsHandler) 