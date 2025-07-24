import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  if (!companyId) {
    return NextResponse.json(
      { success: false, error: 'Company ID is required' },
      { status: 400 }
    )
  }

  try {
    console.log(`Fetching job postings for company_id: ${companyId}`)

    // Get all job postings for this company with essential details
    const { data: jobPostings, error } = await supabaseService.client
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