import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Job posting ID is required'
      }, { status: 400 })
    }

    // Fetch job posting with company info
    const { data: jobPosting, error } = await supabase
      .from('job_postings')
      .select(`
        id,
        title,
        location,
        status,
        review_status,
        created_at,
        scraped_at,
        job_type,
        salary,
        url,
        description,
        company_id,
        source_id,
        platform_id,
        employment,
        career_level,
        education_level,
        working_hours_min,
        working_hours_max,
        categories,
        end_date,
        city,
        zipcode,
        street,
        country,
        companies (
          id,
          name,
          website,
          logo_url,
          rating_indeed,
          is_customer
        ),
        job_sources (
          id,
          name
        ),
        platforms (
          id,
          regio_platform
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching job posting:', error)
      return NextResponse.json({
        success: false,
        error: 'Job posting not found',
        details: error.message
      }, { status: 404 })
    }

    // Flatten the response to match expected format
    // Note: Foreign key relations return an object when using .single()
    const company = jobPosting.companies as { id: string; name: string; website: string | null; logo_url: string | null; rating_indeed: number | null; is_customer: boolean | null } | null
    const jobSource = jobPosting.job_sources as { id: string; name: string } | null
    const platform = jobPosting.platforms as { id: string; regio_platform: string } | null

    const flattenedJob = {
      ...jobPosting,
      company_name: company?.name,
      company_logo: company?.logo_url,
      company_rating: company?.rating_indeed,
      company_website: company?.website,
      is_customer: company?.is_customer,
      source_name: jobSource?.name,
      regio_platform: platform?.regio_platform,
      // Keep companies object for backward compatibility
    }

    return NextResponse.json({
      success: true,
      data: flattenedJob
    })

  } catch (error) {
    console.error('Error in job posting API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
