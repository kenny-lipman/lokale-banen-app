import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface QualifyCompanyRequest {
  companyId: string
  qualification_status: 'qualified' | 'disqualified' | 'review' | 'pending'
  qualification_notes?: string
}

interface BulkQualifyRequest {
  companyIds: string[]
  qualification_status: 'qualified' | 'disqualified' | 'review' | 'pending'
  qualification_notes?: string
}

// Validation function for Apollo enrichment eligibility
function validateApolloEnrichmentEligibility(companies: any[], action: string): { isValid: boolean; error?: string } {
  // Check if this is an Apollo enrichment action (can be inferred from request context)
  // For now, we'll add this validation when the frontend calls with Apollo context
  const nonQualifiedCompanies = companies.filter(c => c.qualification_status !== 'qualified')
  
  if (action === 'apollo_enrichment' && nonQualifiedCompanies.length > 0) {
    return {
      isValid: false,
      error: `Apollo enrichment is only allowed for qualified companies. Found ${nonQualifiedCompanies.length} non-qualified companies.`
    }
  }
  
  return { isValid: true }
}

// Single company qualification
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const body: QualifyCompanyRequest = await request.json()
    const { companyId, qualification_status, qualification_notes } = body

    // Validate input
    if (!companyId || !qualification_status) {
      return NextResponse.json(
        { success: false, error: 'Company ID and qualification status are required' },
        { status: 400 }
      )
    }

    if (!['qualified', 'disqualified', 'review', 'pending'].includes(qualification_status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid qualification status' },
        { status: 400 }
      )
    }

    // Check if company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      )
    }

    // Update company qualification
    const { data: updatedCompany, error: updateError } = await supabase
      .from('companies')
      .update({
        qualification_status,
        qualification_timestamp: new Date().toISOString(),
        qualification_notes: qualification_notes || null
      })
      .eq('id', companyId)
      .select('id, name, qualification_status, qualification_timestamp')
      .single()

    if (updateError) {
      console.error('Error updating company qualification:', updateError)
      
      // Check if error is due to missing columns
      if (updateError.message.includes('qualification_status') || 
          updateError.message.includes('qualification_timestamp') || 
          updateError.message.includes('qualification_notes')) {
        return NextResponse.json({
          success: false,
          error: 'Database schema not ready: qualification columns missing. Please apply migration to add qualification fields.',
          details: {
            originalError: updateError.message,
            migrationNeeded: 'Add qualification_status, qualification_timestamp, qualification_notes columns to companies table'
          }
        }, { status: 500 })
      }
      
      return NextResponse.json(
        { success: false, error: 'Failed to update company qualification', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        company: updatedCompany,
        message: `Company "${company.name}" ${qualification_status === 'qualified' ? 'qualified' : qualification_status === 'disqualified' ? 'disqualified' : 'marked for review'} successfully`
      }
    })

  } catch (error) {
    console.error('Error in company qualification:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Bulk company qualification
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    
    const body: BulkQualifyRequest = await request.json()
    const { companyIds, qualification_status, qualification_notes } = body

    // Validate input
    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Company IDs array is required' },
        { status: 400 }
      )
    }

    if (!qualification_status || !['qualified', 'disqualified', 'review', 'pending'].includes(qualification_status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid qualification status' },
        { status: 400 }
      )
    }

    // Limit bulk operations to prevent abuse
    if (companyIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 companies can be qualified at once' },
        { status: 400 }
      )
    }

    // Get companies to verify they exist
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds)

    if (companiesError) {
      console.error('Error fetching companies:', companiesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch companies' },
        { status: 500 }
      )
    }

    const foundCompanyIds = companies?.map(c => c.id) || []
    const notFoundIds = companyIds.filter(id => !foundCompanyIds.includes(id))

    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Companies not found: ${notFoundIds.slice(0, 3).join(', ')}${notFoundIds.length > 3 ? '...' : ''}` 
        },
        { status: 404 }
      )
    }

    // Bulk update companies
    const { data: updatedCompanies, error: updateError } = await supabase
      .from('companies')
      .update({
        qualification_status,
        qualification_timestamp: new Date().toISOString(),
        qualification_notes: qualification_notes || null
      })
      .in('id', companyIds)
      .select('id, name, qualification_status')

    if (updateError) {
      console.error('Error bulk updating company qualifications:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update company qualifications' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_count: updatedCompanies?.length || 0,
        companies: updatedCompanies,
        message: `${updatedCompanies?.length || 0} companies ${qualification_status === 'qualified' ? 'qualified' : qualification_status === 'disqualified' ? 'disqualified' : 'marked for review'} successfully`
      }
    })

  } catch (error) {
    console.error('Error in bulk company qualification:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}