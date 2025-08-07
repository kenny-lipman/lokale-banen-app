import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface QualifyCompanyRequest {
  companyId: string
  qualification_status: 'qualified' | 'disqualified' | 'review'
  qualification_notes?: string
}

interface BulkQualifyRequest {
  companyIds: string[]
  qualification_status: 'qualified' | 'disqualified' | 'review'
  qualification_notes?: string
}

// Single company qualification
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // For now, we'll skip the qualified_by_user field since authentication isn't set up
    // TODO: Implement proper authentication later

    const body: QualifyCompanyRequest = await request.json()
    const { companyId, qualification_status, qualification_notes } = body

    // Validate input
    if (!companyId || !qualification_status) {
      return NextResponse.json(
        { success: false, error: 'Company ID and qualification status are required' },
        { status: 400 }
      )
    }

    if (!['qualified', 'disqualified', 'review'].includes(qualification_status)) {
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

    // First check if qualification fields exist by trying a simple select
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('companies')
      .select('id, qualification_status')
      .eq('id', companyId)
      .limit(1)

    if (schemaError && schemaError.message.includes('qualification_status')) {
      return NextResponse.json({
        success: false,
        error: 'Database schema not ready: qualification_status column does not exist. Please apply migration 013.',
        details: {
          missingColumn: 'qualification_status',
          migrationNeeded: '013_add_company_qualification_fields.sql'
        }
      }, { status: 500 })
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
          updateError.message.includes('qualified_by_user') || 
          updateError.message.includes('qualification_notes')) {
        return NextResponse.json({
          success: false,
          error: 'Database schema not ready: qualification columns missing. Please apply migration 013.',
          details: {
            originalError: updateError.message,
            migrationNeeded: '013_add_company_qualification_fields.sql'
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
    
    // For now, we'll skip the qualified_by_user field since authentication isn't set up
    // TODO: Implement proper authentication later

    const body: BulkQualifyRequest = await request.json()
    const { companyIds, qualification_status, qualification_notes } = body

    // Validate input
    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Company IDs array is required' },
        { status: 400 }
      )
    }

    if (!qualification_status || !['qualified', 'disqualified', 'review'].includes(qualification_status)) {
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