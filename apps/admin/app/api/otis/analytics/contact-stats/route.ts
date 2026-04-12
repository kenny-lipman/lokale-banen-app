import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    
    // Optional filters
    const runId = searchParams.get('runId')
    const timeframe = searchParams.get('timeframe') || '30' // days
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Calculate date filters
    const dateFilter = startDate && endDate ? 
      { start: startDate, end: endDate } :
      { 
        start: new Date(Date.now() - parseInt(timeframe) * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      }
    
    // Base query for contacts
    let contactsQuery = supabase
      .from('contacts')
      .select(`
        id,
        qualification_status,
        qualification_timestamp,
        is_key_contact,
        contact_priority,
        email_status,
        campaign_id,
        campaign_name,
        created_at,
        companies!inner(
          id,
          name,
          apollo_enriched_at
        )
      `)
      .gte('created_at', dateFilter.start)
      .lte('created_at', dateFilter.end)
    
    // Filter by run if specified
    if (runId) {
      const { data: runCompanies } = await supabase
        .from('job_postings')
        .select('companies!inner(id)')
        .eq('apify_run_id', runId)
      
      if (runCompanies && runCompanies.length > 0) {
        const companyIds = runCompanies.map(jp => jp.companies?.id).filter(Boolean)
        contactsQuery = contactsQuery.in('company_id', companyIds)
      }
    }
    
    const { data: contacts, error: contactsError } = await contactsQuery
    
    if (contactsError) {
      console.error('Error fetching contacts for analytics:', contactsError)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch contact data'
      }, { status: 500 })
    }
    
    // Calculate statistics
    const stats = {
      total_contacts: contacts?.length || 0,
      
      // Qualification breakdown
      qualification_stats: {
        qualified: contacts?.filter(c => c.qualification_status === 'qualified').length || 0,
        disqualified: contacts?.filter(c => c.qualification_status === 'disqualified').length || 0,
        review: contacts?.filter(c => c.qualification_status === 'review').length || 0,
        pending: contacts?.filter(c => !c.qualification_status || c.qualification_status === 'pending').length || 0
      },
      
      // Contact types
      contact_types: {
        key_contacts: contacts?.filter(c => c.is_key_contact).length || 0,
        standard_contacts: contacts?.filter(c => !c.is_key_contact).length || 0
      },
      
      // Email verification status
      email_verification: {
        verified: contacts?.filter(c => c.email_status === 'verified').length || 0,
        pending: contacts?.filter(c => c.email_status === 'pending' || !c.email_status).length || 0,
        failed: contacts?.filter(c => c.email_status === 'failed').length || 0
      },
      
      // Campaign assignment
      campaign_stats: {
        assigned_to_campaigns: contacts?.filter(c => c.campaign_id).length || 0,
        unassigned: contacts?.filter(c => !c.campaign_id).length || 0,
        unique_campaigns: new Set(contacts?.map(c => c.campaign_id).filter(Boolean)).size
      },
      
      // Apollo enrichment status
      apollo_stats: {
        from_apollo_enriched_companies: contacts?.filter(c => c.companies?.apollo_enriched_at).length || 0,
        from_non_enriched_companies: contacts?.filter(c => !c.companies?.apollo_enriched_at).length || 0
      },
      
      // Priority distribution
      priority_distribution: {
        high: contacts?.filter(c => c.contact_priority && c.contact_priority <= 3).length || 0,
        medium: contacts?.filter(c => c.contact_priority && c.contact_priority >= 4 && c.contact_priority <= 7).length || 0,
        low: contacts?.filter(c => c.contact_priority && c.contact_priority >= 8).length || 0,
        unset: contacts?.filter(c => !c.contact_priority).length || 0
      }
    }
    
    // Calculate qualification rates and trends
    const qualificationRate = stats.total_contacts > 0 ? 
      ((stats.qualification_stats.qualified / stats.total_contacts) * 100).toFixed(1) : '0'
    
    const keyContactRate = stats.total_contacts > 0 ? 
      ((stats.contact_types.key_contacts / stats.total_contacts) * 100).toFixed(1) : '0'
    
    const campaignAssignmentRate = stats.total_contacts > 0 ? 
      ((stats.campaign_stats.assigned_to_campaigns / stats.total_contacts) * 100).toFixed(1) : '0'
    
    // Recent activity (last 7 days)
    const recentActivity = {
      recent_qualifications: contacts?.filter(c => 
        c.qualification_timestamp && 
        new Date(c.qualification_timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0,
      
      recent_campaign_assignments: contacts?.filter(c => 
        c.campaign_id && 
        new Date(c.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0
    }
    
    return NextResponse.json({
      success: true,
      data: {
        timeframe: {
          start: dateFilter.start,
          end: dateFilter.end,
          days: timeframe
        },
        run_id: runId,
        statistics: stats,
        rates: {
          qualification_rate: `${qualificationRate}%`,
          key_contact_rate: `${keyContactRate}%`,
          campaign_assignment_rate: `${campaignAssignmentRate}%`
        },
        recent_activity: recentActivity,
        generated_at: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('Error generating contact analytics:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}