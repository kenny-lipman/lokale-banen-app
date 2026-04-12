import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function companyJobPostingsHandler(
  req: NextRequest,
  authResult: AuthResult,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params

  if (!companyId) {
    return NextResponse.json(
      { success: false, error: 'Company ID is required' },
      { status: 400 }
    )
  }

  try {
    console.log(`Fetching job postings for company_id: ${companyId}`)
    console.log(`Using authenticated user: ${authResult.user?.email}`)

    // Get all job postings for this company with essential details
    const { data: jobPostings, error } = await authResult.supabase
      .from('job_postings')
      .select(`
        id,
        title,
        location,
        status,
        review_status,
        url,
        description,
        job_type,
        salary,
        country,
        created_at,
        scraped_at,
        external_vacancy_id,
        apify_run_id
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching job postings:', error)
      throw error
    }

    console.log(`Found ${jobPostings?.length || 0} job postings for company_id: ${companyId}`)
    if (jobPostings?.length === 0) {
      console.log('DEBUG: No job postings found - checking if RLS is blocking...')
    }

    return NextResponse.json({
      success: true,
      data: {
        company_id: companyId,
        job_postings: jobPostings || [],
        count: jobPostings?.length || 0
      }
    })

  } catch (error: any) {
    console.error('Error getting job postings for company:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get job postings',
      details: error.message
    }, { status: 500 })
  }
} 
export const GET = withAuth(companyJobPostingsHandler)
