import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apifyRunId = searchParams.get('apifyRunId')

    console.log('Contacts API called with apifyRunId:', apifyRunId)

    if (!apifyRunId) {
      return NextResponse.json(
        { success: false, error: 'Apify run ID is required' },
        { status: 400 }
      )
    }

    // First get company IDs for this apify run
    const { data: jobPostings, error: jobError } = await supabase
      .from('job_postings')
      .select('company_id')
      .eq('apify_run_id', apifyRunId)
      .not('company_id', 'is', null)

    if (jobError) {
      console.error('Error fetching job postings:', jobError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch job postings' },
        { status: 500 }
      )
    }

    const companyIds = [...new Set(jobPostings?.map(jp => jp.company_id) || [])]
    console.log('Found company IDs:', companyIds)

    if (companyIds.length === 0) {
      console.log('No companies found for this run')
      return NextResponse.json({
        success: true,
        data: {
          contacts: [],
          companyCount: 0
        }
      })
    }

    // Get contacts for these companies with company names
    console.log('Fetching contacts for company IDs:', companyIds)
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        first_name,
        last_name,
        email,
        title,
        company_id,
        linkedin_url,
        campaign_id,
        campaign_name,
        email_status,
        phone,
        companies (
          id,
          name
        )
      `)
      .in('company_id', companyIds)
      .not('email', 'is', null) // Only get contacts with emails
      .order('first_name', { ascending: true })

    console.log('Contacts query result:', { contacts, error })

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    // Transform the data to match the expected format
    const transformedContacts = contacts?.map(contact => ({
      id: contact.id,
      name: contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      email: contact.email,
      title: contact.title,
      linkedin_url: contact.linkedin_url,
      campaign_id: contact.campaign_id,
      campaign_name: contact.campaign_name,
      email_status: contact.email_status,
      phone: contact.phone,
      company_name: contact.companies?.name || 'Unknown Company',
      company_id: contact.company_id
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        contacts: transformedContacts,
        companyCount: companyIds.length
      }
    })

  } catch (error) {
    console.error('Error in contacts API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
} 