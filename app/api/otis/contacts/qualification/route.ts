import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { contactLogger } from '@/lib/error-logger'
import { cacheService } from '@/lib/cache-service'

// POST /api/otis/contacts/qualification
export async function POST(request: NextRequest) {
  let contactId: string | undefined
  
  try {
    const supabase = createClient()
    
    // Parse request body
    const requestBody = await request.json()
    contactId = requestBody.contactId
    const { qualification_status, qualification_notes } = requestBody
    
    // Validate required fields
    if (!contactId || !qualification_status) {
      return NextResponse.json({
        success: false,
        error: 'Contact ID and qualification status are required'
      }, { status: 400 })
    }
    
    // Validate qualification status
    const validStatuses = ['pending', 'qualified', 'disqualified', 'review']
    if (!validStatuses.includes(qualification_status)) {
      return NextResponse.json({
        success: false,
        error: `Invalid qualification status. Must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 })
    }
    
    // For now, we'll skip the qualified_by_user field since authentication isn't set up
    // TODO: Implement proper authentication later
    const user = { id: 'system' } // Placeholder for activity logging
    
    // Get current contact data for activity logging
    const { data: currentContact, error: fetchError } = await supabase
      .from('contacts')
      .select('qualification_status, qualification_notes')
      .eq('id', contactId)
      .single()
    
    if (fetchError) {
      contactLogger.error('Failed to fetch current contact data', fetchError, request, { contactId })
      return NextResponse.json({
        success: false,
        error: 'Contact not found'
      }, { status: 404 })
    }
    
    // Update contact qualification
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update({
        qualification_status,
        qualification_notes: qualification_notes || null,
        qualification_timestamp: new Date().toISOString()
        // qualified_by_user: user.id  // Skip for now until authentication is properly set up
      })
      .eq('id', contactId)
      .select('*')
      .single()
    
    if (updateError) {
      contactLogger.error('Failed to update contact qualification', updateError, request, { contactId, qualification_status })
      return NextResponse.json({
        success: false,
        error: 'Failed to update contact qualification'
      }, { status: 500 })
    }
    
    // Log the activity
    try {
      await fetch(new URL('/api/otis/contacts/activity', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId,
          action_type: 'qualification_change',
          old_value: {
            qualification_status: currentContact.qualification_status,
            qualification_notes: currentContact.qualification_notes
          },
          new_value: {
            qualification_status,
            qualification_notes
          },
          metadata: {
            user_id: user.id,
            changed_by: 'otis_ui'
          }
        })
      })
    } catch (activityError) {
      // Don't fail the main operation if activity logging fails
      contactLogger.warn('Failed to log contact activity', request, { 
        contactId, 
        error: activityError instanceof Error ? activityError.message : 'Unknown error' 
      })
    }

    // Invalidate cache for contacts by company to ensure fresh data
    try {
      // Get the company ID to invalidate related caches
      const { data: contactData } = await supabase
        .from('contacts')
        .select('company_id')
        .eq('id', contactId)
        .single()

      if (contactData?.company_id) {
        // Get the apify_run_id for this company to invalidate the correct cache
        const { data: companyData } = await supabase
          .from('job_postings')
          .select('apify_run_id')
          .eq('company_id', contactData.company_id)
          .limit(1)
          .single()

        if (companyData?.apify_run_id) {
          // Invalidate all contact caches for this run
          const invalidatedCount = cacheService.invalidateContactCaches(companyData.apify_run_id)
          console.log(`Invalidated ${invalidatedCount} cache entries for run ${companyData.apify_run_id}`)
        }
      }
    } catch (cacheError) {
      // Don't fail the main operation if cache invalidation fails
      contactLogger.warn('Failed to invalidate cache', request, { 
        contactId, 
        error: cacheError instanceof Error ? cacheError.message : 'Unknown error' 
      })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        contact: updatedContact,
        message: `Contact ${qualification_status} successfully`
      }
    })
    
  } catch (error) {
    contactLogger.error('Unexpected error in contact qualification API', error instanceof Error ? error : new Error(String(error)), request, { contactId: contactId || 'unknown' })
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET /api/otis/contacts/qualification?contactId=xxx
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    
    if (!contactId) {
      return NextResponse.json({
        success: false,
        error: 'Contact ID is required'
      }, { status: 400 })
    }
    
    // Get contact qualification info
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select(`
        id,
        qualification_status,
        qualification_notes,
        qualification_timestamp,
        qualified_by_user,
        name,
        email,
        title,
        company_id
      `)
      .eq('id', contactId)
      .single()
    
    if (contactError) {
      console.error('Error fetching contact:', contactError)
      return NextResponse.json({
        success: false,
        error: 'Contact not found'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: { contact }
    })
    
  } catch (error) {
    contactLogger.error('Unexpected error in contact qualification GET API', error instanceof Error ? error : new Error(String(error)), request)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Note: Middleware wrapping removed to fix duplicate export error
// The functions are directly exported above