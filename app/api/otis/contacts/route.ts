import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseService.client
    
    // Get all contacts with their company information
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        title,
        linkedin_url,
        campaign_id,
        campaign_name,
        email_status,
        phone,
        company_id,
        company_name,
        created_at,
        updated_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json({ 
        error: 'Failed to fetch contacts' 
      }, { status: 500 })
    }

    // Transform the data to match the expected format
    const transformedContacts = contacts?.map(contact => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      title: contact.title,
      linkedin_url: contact.linkedin_url,
      campaign_id: contact.campaign_id,
      campaign_name: contact.campaign_name,
      email_status: contact.email_status,
      phone: contact.phone,
      companyName: contact.company_name,
      companyId: contact.company_id,
      isKeyContact: contact.title?.toLowerCase().includes('ceo') || 
                   contact.title?.toLowerCase().includes('founder') ||
                   contact.title?.toLowerCase().includes('owner') ||
                   contact.title?.toLowerCase().includes('director'),
      scrapingStatus: contact.email ? 'scraped' : 'failed',
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    })) || []

    return NextResponse.json({
      contacts: transformedContacts,
      totalContacts: transformedContacts.length,
      assignedContacts: transformedContacts.filter(c => c.campaign_id).length,
      unassignedContacts: transformedContacts.filter(c => !c.campaign_id).length
    })

  } catch (error) {
    console.error('Error fetching contacts:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
} 