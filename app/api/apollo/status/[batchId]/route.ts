import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

interface BatchStatus {
  batchId: string
  status: string
  totalCompanies: number
  completedCompanies: number
  failedCompanies: number
  processingCompanies: number
  queuedCompanies: number
  progressPercentage: number
  companies: Array<{
    companyId: string
    companyName: string
    website: string
    status: string
    contactsFound?: number
    errorMessage?: string
    processingStartedAt?: string
    processingCompletedAt?: string
  }>
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId parameter is required" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get batch information
    const { data: batchData, error: batchError } = await supabase
      .from('enrichment_batches')
      .select('*')
      .eq('batch_id', batchId)
      .single()

    if (batchError) {
      if (batchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Batch not found" },
          { status: 404 }
        )
      }
      console.error('Error fetching batch:', batchError)
      return NextResponse.json(
        { error: "Failed to fetch batch information" },
        { status: 500 }
      )
    }

    // Get enrichment status for all companies in the batch
    const { data: statusData, error: statusError } = await supabase
      .from('enrichment_status')
      .select(`
        *,
        companies (
          name
        )
      `)
      .eq('batch_id', batchData.id)
      .order('created_at', { ascending: true })

    if (statusError) {
      console.error('Error fetching enrichment status:', statusError)
      return NextResponse.json(
        { error: "Failed to fetch enrichment status" },
        { status: 500 }
      )
    }

    // Get contact counts for all companies in the batch
    const companyIds = statusData.map(s => s.company_id)
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

    if (statusError) {
      console.error('Error fetching enrichment status:', statusError)
      return NextResponse.json(
        { error: "Failed to fetch enrichment status" },
        { status: 500 }
      )
    }

    // Calculate statistics based on actual enrichment status
    const totalCompanies = statusData.length
    const enrichedCompanies = statusData.filter(s => s.status === 'enriched').length
    const failedCompanies = statusData.filter(s => s.status === 'failed').length
    const processingCompanies = statusData.filter(s => s.status === 'processing').length
    const queuedCompanies = statusData.filter(s => s.status === 'queued').length
    
    const progressPercentage = totalCompanies > 0 
      ? Math.round(((enrichedCompanies + failedCompanies) / totalCompanies) * 100)
      : 0

    // Format company data with actual contact counts and enrichment status
    const companies = statusData.map(status => {
      const actualContactCount = contactCountMap.get(status.company_id) || 0
      const isEnriched = actualContactCount > 0
      
      return {
        companyId: status.company_id,
        companyName: status.companies?.name || 'Unknown Company',
        website: status.website || '',
        status: isEnriched ? 'enriched' : status.status,
        contactsFound: actualContactCount,
        errorMessage: status.error_message || undefined,
        processingStartedAt: status.processing_started_at || undefined,
        processingCompletedAt: status.processing_completed_at || undefined
      }
    })

    // Prepare response
    const response: BatchStatus = {
      batchId: batchData.batch_id,
      status: batchData.status,
      totalCompanies,
      completedCompanies: enrichedCompanies,
      failedCompanies,
      processingCompanies,
      queuedCompanies,
      progressPercentage,
      companies,
      startedAt: batchData.started_at || undefined,
      completedAt: batchData.completed_at || undefined,
      errorMessage: batchData.error_message || undefined
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Update enrichment status (for Apollo webhook callbacks)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params
    const body = await req.json()

    if (!batchId) {
      return NextResponse.json(
        { error: "batchId parameter is required" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get batch information
    const { data: batchData, error: batchError } = await supabase
      .from('enrichment_batches')
      .select('id')
      .eq('batch_id', batchId)
      .single()

    if (batchError) {
      return NextResponse.json(
        { error: "Batch not found" },
        { status: 404 }
      )
    }

    // Handle different types of updates
    if (body.companyId && body.status) {
      // Update individual company status
      const updateData: any = {
        status: body.status,
        updated_at: new Date().toISOString()
      }

      if (body.status === 'processing') {
        updateData.processing_started_at = new Date().toISOString()
      } else if (body.status === 'completed' || body.status === 'failed') {
        updateData.processing_completed_at = new Date().toISOString()
        
        if (body.status === 'completed') {
          updateData.contacts_found = body.contactsFound || 0
          updateData.enriched_data = body.enrichedData || {}
        } else {
          updateData.error_message = body.errorMessage || 'Enrichment failed'
        }
      }

      const { error: updateError } = await supabase
        .from('enrichment_status')
        .update(updateData)
        .eq('batch_id', batchData.id)
        .eq('company_id', body.companyId)

      if (updateError) {
        console.error('Error updating company status:', updateError)
        return NextResponse.json(
          { error: "Failed to update company status" },
          { status: 500 }
        )
      }

      // Update companies table with enrichment data if completed
      if (body.status === 'completed' && body.enrichedData) {
        // Get actual contact count from contacts table
        const { data: contactCount, error: contactError } = await supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', body.companyId)
          .not('company_id', 'is', null)

        const actualContactCount = contactCount || 0

        await supabase
          .from('companies')
          .update({
            apollo_enriched_at: new Date().toISOString(),
            apollo_contacts_count: actualContactCount,
            apollo_enrichment_data: body.enrichedData,
            last_enrichment_batch_id: batchData.id
          })
          .eq('id', body.companyId)
      }
    }

    // Check if batch is complete and update batch status
    const { data: statusCount } = await supabase
      .from('enrichment_status')
      .select('status')
      .eq('batch_id', batchData.id)

    if (statusCount) {
      const total = statusCount.length
      const completed = statusCount.filter(s => s.status === 'completed').length
      const failed = statusCount.filter(s => s.status === 'failed').length
      const finished = completed + failed

      const batchUpdate: any = {
        completed_companies: completed,
        failed_companies: failed
      }

      if (finished === total) {
        // Batch is complete
        batchUpdate.status = 'completed'
        batchUpdate.completed_at = new Date().toISOString()
      }

      await supabase
        .from('enrichment_batches')
        .update(batchUpdate)
        .eq('id', batchData.id)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 