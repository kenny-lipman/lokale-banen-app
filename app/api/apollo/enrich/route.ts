import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

interface EnrichmentRequest {
  batchId: string
  companies: Array<{
    id: string
    website: string
  }>
}

export async function POST(req: NextRequest) {
  try {
    const body: EnrichmentRequest = await req.json()
    const { batchId, companies } = body

    // Validate request
    if (!batchId || !Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json(
        { error: "batchId and companies array are required" },
        { status: 400 }
      )
    }

    // Validate batch size limit
    if (companies.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 companies per batch" },
        { status: 400 }
      )
    }

    // Validate companies have required fields (website is optional)
    const invalidCompanies = companies.filter(c => !c.id)
    if (invalidCompanies.length > 0) {
      return NextResponse.json(
        { error: "All companies must have valid id" },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify all companies exist in database
    const companyIds = companies.map(c => c.id)
    const { data: existingCompanies, error: companyCheckError } = await supabase
      .from('companies')
      .select('id')
      .in('id', companyIds)

    if (companyCheckError) {
      console.error('Error checking companies:', companyCheckError)
      return NextResponse.json(
        { error: "Failed to verify companies" },
        { status: 500 }
      )
    }

    if (existingCompanies.length !== companies.length) {
      return NextResponse.json(
        { error: "Some companies not found in database" },
        { status: 400 }
      )
    }

    // Create enrichment batch record
    const { data: batchData, error: batchError } = await supabase
      .from('enrichment_batches')
      .insert({
        batch_id: batchId,
        status: 'pending',
        total_companies: companies.length,
        webhook_url: 'https://ba.grive-dev.com/webhook/receive-companies-website',
        webhook_payload: { batchId, companies },
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (batchError) {
      console.error('Error creating batch:', batchError)
      return NextResponse.json(
        { error: "Failed to create enrichment batch" },
        { status: 500 }
      )
    }

    // Create individual enrichment status records
    const enrichmentStatusRecords = companies.map(company => ({
      batch_id: batchData.id,
      company_id: company.id,
      status: 'queued',
      website: company.website
    }))

    const { error: statusError } = await supabase
      .from('enrichment_status')
      .insert(enrichmentStatusRecords)

    if (statusError) {
      console.error('Error creating enrichment status records:', statusError)
      
      // Clean up batch record if status creation failed
      await supabase
        .from('enrichment_batches')
        .delete()
        .eq('id', batchData.id)

      return NextResponse.json(
        { error: "Failed to create enrichment status records" },
        { status: 500 }
      )
    }

    // Prepare payload for Apollo webhook
    const apolloPayload = {
      batchId,
      companies: companies.map(c => ({
        id: c.id,
        website: c.website
      }))
    }

    // Call Apollo webhook for each company in parallel
    try {
      const webhookPromises = companies.map(async (company) => {
        const companyPayload = {
          id: company.id,
          website: company.website || null
        }

        try {
          const response = await fetch('https://ba.grive-dev.com/webhook/receive-companies-website', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(companyPayload),
          })

          const responseData = response.ok 
            ? await response.json().catch(() => ({}))
            : { error: `HTTP ${response.status}: ${response.statusText}` }

          // Update individual company status
          await supabase
            .from('enrichment_status')
            .update({
              status: response.ok ? 'processing' : 'failed',
              webhook_response: responseData,
              error_message: response.ok ? null : `Webhook failed: ${response.statusText}`,
              processed_at: new Date().toISOString()
            })
            .eq('batch_id', batchData.id)
            .eq('company_id', company.id)

          return {
            companyId: company.id,
            success: response.ok,
            status: response.status,
            data: responseData
          }
        } catch (error) {
          console.error(`Error calling webhook for company ${company.id}:`, error)
          
          // Update individual company status as failed
          await supabase
            .from('enrichment_status')
            .update({
              status: 'failed',
              error_message: `Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              processed_at: new Date().toISOString()
            })
            .eq('batch_id', batchData.id)
            .eq('company_id', company.id)

          return {
            companyId: company.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      // Wait for all webhook calls to complete
      const webhookResults = await Promise.all(webhookPromises)
      
      // Count successes and failures
      const successfulCalls = webhookResults.filter(r => r.success).length
      const failedCalls = webhookResults.filter(r => !r.success).length
      
      // Determine overall batch status
      const batchStatus = failedCalls === 0 ? 'processing' : 
                         successfulCalls === 0 ? 'failed' : 'partial_success'

      // Update batch with overall results
      await supabase
        .from('enrichment_batches')
        .update({
          status: batchStatus,
          webhook_response: {
            total_companies: companies.length,
            successful_calls,
            failed_calls,
            results: webhookResults
          },
          error_message: failedCalls > 0 ? `${failedCalls} webhook calls failed` : null,
          completed_at: batchStatus === 'failed' ? new Date().toISOString() : null
        })
        .eq('id', batchData.id)

      // If all calls failed, return error
      if (successfulCalls === 0) {
        return NextResponse.json(
          { error: "All Apollo webhook calls failed" },
          { status: 502 }
        )
      }

      // If some calls failed, return partial success
      if (failedCalls > 0) {
        return NextResponse.json({
          success: true,
          batchId,
          batchDbId: batchData.id,
          companiesCount: companies.length,
          successfulCalls,
          failedCalls,
          status: 'partial_success',
          message: `Apollo enrichment started with ${successfulCalls} successful and ${failedCalls} failed webhook calls`
        })
      }

    } catch (webhookError) {
      console.error('Error in parallel webhook calls:', webhookError)
      
      // Update batch status to failed
      await supabase
        .from('enrichment_batches')
        .update({
          status: 'failed',
          error_message: `Webhook error: ${webhookError instanceof Error ? webhookError.message : 'Unknown error'}`
        })
        .eq('id', batchData.id)

      // Mark all individual statuses as failed
      await supabase
        .from('enrichment_status')
        .update({
          status: 'failed',
          error_message: `Webhook error: ${webhookError instanceof Error ? webhookError.message : 'Unknown error'}`
        })
        .eq('batch_id', batchData.id)

      return NextResponse.json(
        { error: "Failed to call Apollo webhooks" },
        { status: 502 }
      )
    }

    // Return success response
    return NextResponse.json({
      success: true,
      batchId,
      batchDbId: batchData.id,
      companiesCount: companies.length,
      status: 'processing',
      message: 'Apollo enrichment started successfully - all webhook calls completed'
    })

  } catch (error) {
    console.error('Apollo enrichment error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 