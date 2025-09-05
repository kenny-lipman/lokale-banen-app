import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cacheService } from '@/lib/cache-service'

// POST /api/otis/contacts/qualification/batch
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Parse request body
    const { contactIds, qualification_status, qualification_notes } = await request.json()
    
    // Validate required fields
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contact IDs array is required and must not be empty'
      }, { status: 400 })
    }
    
    if (!qualification_status) {
      return NextResponse.json({
        success: false,
        error: 'Qualification status is required'
      }, { status: 400 })
    }
    
    // Validate qualification status
    const validStatuses = ['pending', 'qualified', 'disqualified', 'review', 'in_campaign']
    if (!validStatuses.includes(qualification_status)) {
      return NextResponse.json({
        success: false,
        error: `Invalid qualification status. Must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 })
    }

    // Prevent manual setting to 'in_campaign' status - this should only be set automatically via triggers
    if (qualification_status === 'in_campaign') {
      return NextResponse.json({
        success: false,
        error: 'Cannot manually set status to "in_campaign". This status is automatically managed when contacts are added to campaigns.'
      }, { status: 400 })
    }
    
    // Limit batch size for performance
    if (contactIds.length > 100) {
      return NextResponse.json({
        success: false,
        error: 'Batch size cannot exceed 100 contacts'
      }, { status: 400 })
    }
    
    // For now, we'll skip the qualified_by_user field since authentication isn't set up
    // TODO: Implement proper authentication later
    const user = { id: 'system' } // Placeholder for activity logging
    
    // Update contacts in batch
    const { data: updatedContacts, error: updateError } = await supabase
      .from('contacts')
      .update({
        qualification_status,
        qualification_notes: qualification_notes || null,
        qualification_timestamp: new Date().toISOString()
        // qualified_by_user: user.id  // Skip for now until authentication is properly set up
      })
      .in('id', contactIds)
      .select('id, name, first_name, last_name, email, qualification_status')
    
    if (updateError) {
      console.error('Error updating contacts qualification:', updateError)
      return NextResponse.json({
        success: false,
        error: 'Failed to update contacts qualification'
      }, { status: 500 })
    }

    // Invalidate cache for contacts by company to ensure fresh data
    try {
      // Get unique company IDs from updated contacts
      const { data: contactData } = await supabase
        .from('contacts')
        .select('company_id')
        .in('id', contactIds)

      if (contactData && contactData.length > 0) {
        const uniqueCompanyIds = [...new Set(contactData.map(c => c.company_id).filter(Boolean))]
        
        // Get apify_run_ids for these companies
        const { data: companyData } = await supabase
          .from('job_postings')
          .select('apify_run_id')
          .in('company_id', uniqueCompanyIds)

        if (companyData && companyData.length > 0) {
          const uniqueRunIds = [...new Set(companyData.map(c => c.apify_run_id).filter(Boolean))]
          
          // Invalidate cache for all affected runs
          uniqueRunIds.forEach(runId => {
            const invalidatedCount = cacheService.invalidateContactCaches(runId)
            console.log(`Invalidated ${invalidatedCount} cache entries for run ${runId}`)
          })
        }
      }
    } catch (cacheError) {
      // Don't fail the main operation if cache invalidation fails
      console.warn('Failed to invalidate cache after bulk contact update:', cacheError)
    }
    
    return NextResponse.json({
      success: true,
      data: {
        updatedContacts,
        count: updatedContacts?.length || 0,
        message: `${updatedContacts?.length || 0} contacts ${qualification_status} successfully`
      }
    })
    
  } catch (error) {
    console.error('Error in batch contact qualification API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET /api/otis/contacts/qualification/batch?companyId=xxx&status=qualified
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    let query = supabase
      .from('contacts')
      .select(`
        id,
        name,
        first_name,
        last_name,
        email,
        title,
        qualification_status,
        qualification_notes,
        qualification_timestamp,
        company_id,
        is_key_contact,
        contact_priority
      `)
      .range(offset, offset + limit - 1)
      .order('qualification_timestamp', { ascending: false })
    
    // Filter by company if provided
    if (companyId) {
      query = query.eq('company_id', companyId)
    }
    
    // Filter by qualification status if provided
    if (status && status !== 'all') {
      query = query.eq('qualification_status', status)
    }
    
    const { data: contacts, error: contactsError } = await query
    
    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch contacts'
      }, { status: 500 })
    }
    
    // Get count for pagination
    let countQuery = supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
    
    if (companyId) {
      countQuery = countQuery.eq('company_id', companyId)
    }
    
    if (status && status !== 'all') {
      countQuery = countQuery.eq('qualification_status', status)
    }
    
    const { count } = await countQuery
    
    return NextResponse.json({
      success: true,
      data: {
        contacts,
        pagination: {
          total: count || 0,
          limit,
          offset,
          hasMore: (offset + limit) < (count || 0)
        }
      }
    })
    
  } catch (error) {
    console.error('Error in batch contact qualification API:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}