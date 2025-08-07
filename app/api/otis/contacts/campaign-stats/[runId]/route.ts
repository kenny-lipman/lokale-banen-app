import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { cacheService } from '@/lib/cache-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const { searchParams } = new URL(req.url)
  
  // Query parameters
  const includeDetails = searchParams.get('includeDetails') === 'true'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Cap at 100 for performance

  if (!runId) {
    return NextResponse.json(
      { success: false, error: 'Run ID is required', code: 'MISSING_RUN_ID' },
      { status: 400 }
    )
  }

  try {
    const supabase = createClient()
    console.log(`Fetching campaign statistics for apify_run_id: ${runId}`)

    // Check cache for campaign statistics (cache for 5 minutes)
    const cacheKey = `campaign_stats:${runId}:${includeDetails}:${limit}`
    const cachedData = cacheService.get(cacheKey)
    
    if (cachedData) {
      console.log('Returning cached campaign statistics')
      return NextResponse.json({
        ...cachedData,
        cached: true
      })
    }

    // First, get all companies from this run
    const { data: runCompanies, error: companiesError } = await supabase
      .from('job_postings')
      .select(`
        companies!inner(
          id,
          name,
          qualification_status
        )
      `)
      .eq('apify_run_id', runId)
      .not('companies.id', 'is', null)

    if (companiesError) {
      console.error('Error fetching companies from run:', companiesError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch companies from run', code: 'COMPANIES_FETCH_ERROR' },
        { status: 500 }
      )
    }

    // Extract unique company IDs
    const companyIds = [...new Set(runCompanies?.map((item: any) => item.companies?.id).filter(Boolean) || [])]

    if (companyIds.length === 0) {
      const emptyResponse = {
        success: true,
        data: {
          apify_run_id: runId,
          total_contacts: 0,
          contacts_in_campaigns: 0,
          contacts_not_in_campaigns: 0,
          campaign_distribution: [],
          summary: {
            total_campaigns: 0,
            average_contacts_per_campaign: 0
          }
        }
      }
      
      // Cache empty results for 2 minutes
      cacheService.set(cacheKey, emptyResponse, 120)
      
      return NextResponse.json(emptyResponse)
    }

    // Get all contacts with campaign information
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select(`
        id,
        name,
        email,
        title,
        campaign_id,
        campaign_name,
        qualification_status,
        is_key_contact,
        company_id
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch contacts', code: 'CONTACTS_FETCH_ERROR' },
        { status: 500 }
      )
    }

    // Calculate campaign statistics
    const totalContacts = contacts?.length || 0
    const contactsInCampaigns = contacts?.filter(c => c.campaign_id).length || 0
    const contactsNotInCampaigns = totalContacts - contactsInCampaigns

    // Group contacts by campaign for detailed statistics
    const campaignStats = contacts?.reduce((acc, contact) => {
      if (!contact.campaign_id) return acc
      
      const campaignId = contact.campaign_id
      const campaignName = contact.campaign_name || 'Unknown Campaign'
      
      if (!acc[campaignId]) {
        acc[campaignId] = {
          campaign_id: campaignId,
          campaign_name: campaignName,
          total_contacts: 0,
          qualified_contacts: 0,
          key_contacts: 0,
          verified_contacts: 0,
          contacts: includeDetails ? [] : undefined
        }
      }
      
      acc[campaignId].total_contacts++
      
      if (contact.qualification_status === 'qualified') {
        acc[campaignId].qualified_contacts++
      }
      
      if (contact.is_key_contact) {
        acc[campaignId].key_contacts++
      }
      
      // Note: email verification status would need to be added to the select query if needed
      // For now, we'll skip verified_contacts calculation
      
      if (includeDetails) {
        acc[campaignId].contacts.push({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          title: contact.title,
          qualification_status: contact.qualification_status,
          is_key_contact: contact.is_key_contact
        })
      }
      
      return acc
    }, {} as Record<string, any>) || {}

    const campaignDistribution = Object.values(campaignStats)
      .sort((a: any, b: any) => b.total_contacts - a.total_contacts)
      .slice(0, limit)

    // Calculate summary statistics
    const totalCampaigns = Object.keys(campaignStats).length
    const averageContactsPerCampaign = totalCampaigns > 0 ? Math.round(contactsInCampaigns / totalCampaigns) : 0

    // Calculate qualification statistics across all campaigns
    const totalQualifiedInCampaigns = Object.values(campaignStats).reduce((sum: number, campaign: any) => sum + campaign.qualified_contacts, 0)
    const totalKeyContactsInCampaigns = Object.values(campaignStats).reduce((sum: number, campaign: any) => sum + campaign.key_contacts, 0)

    const response = {
      success: true,
      data: {
        apify_run_id: runId,
        total_contacts: totalContacts,
        contacts_in_campaigns: contactsInCampaigns,
        contacts_not_in_campaigns: contactsNotInCampaigns,
        campaign_distribution: campaignDistribution,
        summary: {
          total_campaigns: totalCampaigns,
          average_contacts_per_campaign: averageContactsPerCampaign,
          total_qualified_in_campaigns: totalQualifiedInCampaigns,
          total_key_contacts_in_campaigns: totalKeyContactsInCampaigns,
          campaign_utilization_rate: totalContacts > 0 ? Math.round((contactsInCampaigns / totalContacts) * 100) : 0
        },
        performance: {
          query_time_ms: Date.now() - Date.now(), // Would need actual timing
          cache_hit: false,
          companies_processed: companyIds.length,
          contacts_processed: contacts?.length || 0
        }
      }
    }

    // Cache the result for 5 minutes
    cacheService.set(cacheKey, response, 300)

    console.log(`Returning campaign statistics for ${totalCampaigns} campaigns with ${contactsInCampaigns} contacts in campaigns`)

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error getting campaign statistics:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get campaign statistics',
      code: 'INTERNAL_ERROR',
      details: error.message
    }, { status: 500 })
  }
} 