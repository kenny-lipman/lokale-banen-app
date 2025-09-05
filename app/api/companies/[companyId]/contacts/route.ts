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
    // Fetch contacts for the company
    const { data: contacts, error } = await supabaseService.client
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
        campaign_id,
        campaign_name,
        created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching contacts:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        contacts: contacts || [],
        count: contacts?.length || 0
      }
    })
  } catch (error) {
    console.error('Error in contacts endpoint:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}