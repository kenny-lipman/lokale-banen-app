import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params

    // Input validation
    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'Company ID is required'
      }, { status: 400 })
    }

    // Fetch company details with all fields needed by CompanyDrawer
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        website,
        location,
        description,
        category_size,
        size_min,
        size_max,
        qualification_status,
        qualification_timestamp,
        qualification_notes,
        qualified_by_user,
        enrichment_status,
        apollo_enriched_at,
        apollo_contacts_count,
        created_at,
        indeed_url,
        logo_url,
        rating_indeed,
        review_count_indeed,
        is_customer,
        source,
        linkedin_url,
        kvk,
        phone,
        industries,
        city,
        status,
        start,
        hoofddomein,
        subdomeinen
      `)
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('Error fetching company:', companyError)
      return NextResponse.json({
        success: false,
        error: 'Company not found',
        details: companyError.message
      }, { status: 404 })
    }

    // Fetch job postings for this company
    const { data: jobPostings, error: jobsError } = await supabase
      .from('job_postings')
      .select(`
        id,
        title,
        location,
        status,
        review_status,
        created_at,
        job_type,
        salary,
        url,
        description,
        apify_run_id
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (jobsError) {
      console.error('Error fetching job postings:', jobsError)
      // Don't fail the whole request if job postings fail
    }

    // Fetch contacts for this company with sync status
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        first_name,
        email,
        title,
        linkedin_url,
        phone,
        email_status,
        created_at,
        campaign_id,
        campaign_name,
        pipedrive_synced,
        pipedrive_synced_at,
        pipedrive_person_id,
        instantly_synced,
        instantly_synced_at,
        instantly_status
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      // Don't fail the whole request if contacts fail
    }

    // Process contacts to identify key contacts
    const processedContacts = (contacts || []).map(contact => ({
      ...contact,
      is_key_contact: contact.title && (
        contact.title.toLowerCase().includes('ceo') ||
        contact.title.toLowerCase().includes('cto') ||
        contact.title.toLowerCase().includes('founder') ||
        contact.title.toLowerCase().includes('director') ||
        contact.title.toLowerCase().includes('manager')
      )
    }))

    // Try to fetch enrichment data if available
    let enrichmentData = null
    if (company.enrichment_status === 'completed') {
      try {
        // This would be where we fetch from a separate enrichment_data table
        // For now, we'll create mock enrichment data based on company info
        enrichmentData = {
          organization: {
            name: company.name,
            employees: company.size_max || company.size_min || 50,
            industry: company.category_size || 'Technology',
            founded_year: null,
            revenue: null,
            headquarters: company.location
          },
          enriched_at: company.enrichment_completed_at || company.created_at,
          enrichment_source: 'Apollo API'
        }
      } catch (enrichmentError) {
        console.error('Error fetching enrichment data:', enrichmentError)
        // Don't fail if enrichment data is missing
      }
    }

    // Calculate counts
    const jobCount = jobPostings?.length || 0
    const contactsFound = processedContacts?.length || 0

    // Prepare response
    const companyDetails = {
      ...company,
      job_count: jobCount,
      contactsFound: contactsFound,
      job_postings: jobPostings || [],
      contacts: processedContacts || [],
      enrichment_data: enrichmentData
    }

    return NextResponse.json({
      success: true,
      data: companyDetails
    })

  } catch (error) {
    console.error('Error in company details API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}