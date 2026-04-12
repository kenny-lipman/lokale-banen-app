import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface ContactSelectionRequest {
  contactIds: string[]
  sessionId: string
  apifyRunId?: string
  selectionType?: 'manual' | 'bulk_company' | 'bulk_qualification'
  isSelected: boolean
}

interface ContactSelectionResponse {
  success: boolean
  data?: {
    updated_count: number
    session_id: string
    selected_contacts: string[]
    deselected_contacts: string[]
  }
  error?: string
}

// Get contact selections for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const apifyRunId = searchParams.get('apifyRunId')

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Build query
    let query = supabase
      .from('contact_selections')
      .select(`
        id,
        contact_id,
        company_id,
        apify_run_id,
        selected_at,
        selection_type,
        is_selected,
        contacts!inner(
          id,
          name,
          email,
          title,
          company_name
        )
      `)
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('is_selected', true)
      .order('selected_at', { ascending: false })

    if (apifyRunId) {
      query = query.eq('apify_run_id', apifyRunId)
    }

    const { data: selections, error: selectionsError } = await query

    if (selectionsError) {
      console.error('Error fetching contact selections:', selectionsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contact selections' },
        { status: 500 }
      )
    }

    // Group by company for easier frontend handling
    const selectionsByCompany = new Map()
    
    selections?.forEach(selection => {
      const companyId = selection.company_id
      if (!selectionsByCompany.has(companyId)) {
        selectionsByCompany.set(companyId, {
          company_id: companyId,
          company_name: selection.contacts.company_name,
          contacts: []
        })
      }
      
      selectionsByCompany.get(companyId).contacts.push({
        id: selection.contact_id,
        name: selection.contacts.name,
        email: selection.contacts.email,
        title: selection.contacts.title,
        selected_at: selection.selected_at,
        selection_type: selection.selection_type
      })
    })

    const companiesWithSelections = Array.from(selectionsByCompany.values())
    const totalSelectedContacts = selections?.length || 0

    return NextResponse.json({
      success: true,
      data: {
        session_id: sessionId,
        apify_run_id: apifyRunId,
        total_selected_contacts: totalSelectedContacts,
        companies_with_selections: companiesWithSelections,
        raw_selections: selections
      }
    })

  } catch (error) {
    console.error('Error getting contact selections:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update contact selections
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: ContactSelectionRequest = await request.json()
    const { 
      contactIds, 
      sessionId, 
      apifyRunId, 
      selectionType = 'manual', 
      isSelected 
    } = body

    // Validate input
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact IDs array is required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Limit bulk operations
    if (contactIds.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Maximum 100 contacts can be selected at once' },
        { status: 400 }
      )
    }

    // Get contact details to ensure they exist and get company IDs
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, company_id, name, email')
      .in('id', contactIds)

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts found' },
        { status: 404 }
      )
    }

    const foundContactIds = contacts.map(c => c.id)
    const notFoundIds = contactIds.filter(id => !foundContactIds.includes(id))

    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Contacts not found: ${notFoundIds.slice(0, 3).join(', ')}${notFoundIds.length > 3 ? '...' : ''}` 
        },
        { status: 404 }
      )
    }

    // Prepare selection records
    const selectionRecords = contacts.map(contact => ({
      session_id: sessionId,
      user_id: user.id,
      contact_id: contact.id,
      company_id: contact.company_id,
      apify_run_id: apifyRunId,
      selection_type: selectionType,
      is_selected: isSelected,
      selected_at: new Date().toISOString()
    }))

    if (isSelected) {
      // When selecting contacts, use upsert to handle existing selections
      const { data: upsertedSelections, error: upsertError } = await supabase
        .from('contact_selections')
        .upsert(selectionRecords, {
          onConflict: 'session_id,contact_id',
          ignoreDuplicates: false
        })
        .select('contact_id')

      if (upsertError) {
        console.error('Error upserting contact selections:', upsertError)
        return NextResponse.json(
          { success: false, error: 'Failed to update contact selections' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          updated_count: upsertedSelections?.length || 0,
          session_id: sessionId,
          selected_contacts: foundContactIds,
          deselected_contacts: [],
          message: `Selected ${foundContactIds.length} contacts`
        }
      })

    } else {
      // When deselecting contacts, update existing records or delete them
      const { data: deselectedContacts, error: deselectError } = await supabase
        .from('contact_selections')
        .update({ is_selected: false, updated_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .in('contact_id', foundContactIds)
        .select('contact_id')

      if (deselectError) {
        console.error('Error deselecting contacts:', deselectError)
        return NextResponse.json(
          { success: false, error: 'Failed to deselect contacts' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          updated_count: deselectedContacts?.length || 0,
          session_id: sessionId,
          selected_contacts: [],
          deselected_contacts: foundContactIds,
          message: `Deselected ${foundContactIds.length} contacts`
        }
      })
    }

  } catch (error) {
    console.error('Error updating contact selections:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Clear all selections for a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete all selections for this session and user
    const { data: deletedSelections, error: deleteError } = await supabase
      .from('contact_selections')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .select('contact_id')

    if (deleteError) {
      console.error('Error clearing contact selections:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to clear contact selections' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        cleared_count: deletedSelections?.length || 0,
        session_id: sessionId,
        message: `Cleared ${deletedSelections?.length || 0} contact selections`
      }
    })

  } catch (error) {
    console.error('Error clearing contact selections:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}