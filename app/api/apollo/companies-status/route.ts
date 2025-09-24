import { NextRequest, NextResponse } from "next/server"
import { withAuth, AuthResult } from "@/lib/auth-middleware"

interface CompanyEnrichmentStatus {
  companyId: string
  companyName: string
  website: string
  enrichmentStatus: string
  contactsFound?: number
  errorMessage?: string
  processingStartedAt?: string
  processingCompletedAt?: string
  batchId?: string
}

async function apolloCompaniesStatusHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const { companyIds } = await req.json()

    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: "companyIds array is required" },
        { status: 400 }
      )
    }

    const { supabase } = authResult

    // Get enrichment status for the specified companies
    const { data: statusData, error: statusError } = await supabase
      .from('enrichment_status')
      .select(`
        *,
        companies (
          name,
          website
        ),
        enrichment_batches (
          batch_id
        )
      `)
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })

    if (statusError) {
      console.error('Error fetching enrichment status:', statusError)
      return NextResponse.json(
        { error: "Failed to fetch enrichment status" },
        { status: 500 }
      )
    }

    // Get contact counts for all companies
    const { data: contactCounts, error: contactError } = await supabase
      .from('contacts')
      .select('company_id')
      .in('company_id', companyIds)
      .not('company_id', 'is', null)

    if (contactError) {
      console.error('Error fetching contact counts:', contactError)
      return NextResponse.json(
        { error: "Failed to fetch contact counts" },
        { status: 500 }
      )
    }

    // Calculate contact counts per company
    const contactCountMap = new Map<string, number>()
    contactCounts?.forEach(contact => {
      const companyId = contact.company_id
      contactCountMap.set(companyId, (contactCountMap.get(companyId) || 0) + 1)
    })

    // Format response data
    const companiesStatus: CompanyEnrichmentStatus[] = statusData.map(status => {
      const actualContactCount = contactCountMap.get(status.company_id) || 0
      const isEnriched = actualContactCount > 0
      
      return {
        companyId: status.company_id,
        companyName: status.companies?.name || 'Unknown Company',
        website: status.companies?.website || status.website || '',
        enrichmentStatus: isEnriched ? 'enriched' : status.status,
        contactsFound: actualContactCount,
        errorMessage: status.error_message || undefined,
        processingStartedAt: status.processing_started_at || undefined,
        processingCompletedAt: status.processing_completed_at || undefined,
        batchId: status.enrichment_batches?.batch_id || undefined
      }
    })

    return NextResponse.json({ companies: companiesStatus })

  } catch (error) {
    console.error('Companies status API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 
export const POST = withAuth(apolloCompaniesStatusHandler)
