import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { selectedCompanyIds, apifyRunId } = await req.json()
    
    if (!selectedCompanyIds || !Array.isArray(selectedCompanyIds) || selectedCompanyIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'selectedCompanyIds is required and must be a non-empty array' 
      }, { status: 400 })
    }

    if (!apifyRunId) {
      return NextResponse.json({ 
        success: false, 
        error: 'apifyRunId is required' 
      }, { status: 400 })
    }

    console.log('🎯 Starting enrichment for companies:', selectedCompanyIds.length)
    console.log('📊 Apify Run ID:', apifyRunId)

    // Create regular client (RLS disabled for enrichment tables)
    const supabase = createClient()

    // Get the apify run details to find the region
    const { data: apifyRun, error: runError } = await supabase
      .from('apify_runs')
      .select('region_id, regions(plaats)')
      .eq('id', apifyRunId)
      .single()

    if (runError || !apifyRun) {
      console.error('❌ Error fetching apify run:', runError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch apify run details' 
      }, { status: 500 })
    }

    // Get companies by their IDs (removed apify_run_id filter since it doesn't exist in companies table)
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, website, location, status')
      .in('id', selectedCompanyIds)

    if (companiesError) {
      console.error('❌ Error fetching companies:', companiesError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch companies' 
      }, { status: 500 })
    }

    if (!companies || companies.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No companies found for the selected IDs' 
      }, { status: 404 })
    }

    console.log('🏢 Found companies:', companies.length)

    // Create enrichment batch
    const batchId = `enrichment_${Date.now()}`
    const { data: batchData, error: batchError } = await supabase
      .from('enrichment_batches')
      .insert({
        batch_id: batchId,
        apify_run_id: apifyRunId,
        total_companies: companies.length,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (batchError) {
      console.error('❌ Error creating enrichment batch:', batchError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create enrichment batch' 
      }, { status: 500 })
    }

    // Update companies with enrichment status
    const { error: updateError } = await supabase
      .from('companies')
      .update({ 
        enrichment_status: 'pending',
        enrichment_batch_id: batchData.id
      })
      .in('id', selectedCompanyIds)

    if (updateError) {
      console.error('❌ Error updating companies:', updateError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update companies' 
      }, { status: 500 })
    }

    // Send webhook requests to Apollo
    let successfulRequests = 0
    let failedRequests = 0

    for (const company of companies) {
      try {
        const webhookUrl = process.env.APOLLO_WEBHOOK_URL
        if (!webhookUrl) {
          console.error('❌ APOLLO_WEBHOOK_URL not configured')
          failedRequests++
          continue
        }

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_name: company.name,
            website: company.website,
            location: company.location || apifyRun.regions?.plaats,
            batch_id: batchId,
            company_id: company.id,
            region_id: apifyRun.region_id
          })
        })

        if (response.ok) {
          successfulRequests++
          console.log(`✅ Webhook sent for ${company.name}`)
        } else {
          failedRequests++
          console.error(`❌ Webhook failed for ${company.name}:`, response.status)
        }
      } catch (error) {
        failedRequests++
        console.error(`❌ Webhook error for ${company.name}:`, error)
      }
    }

    console.log(`📊 Enrichment started: ${successfulRequests} successful, ${failedRequests} failed`)

    return NextResponse.json({
      success: true,
      data: {
        batchId,
        totalCompanies: companies.length,
        successfulRequests,
        failedRequests
      }
    })

  } catch (error) {
    console.error('❌ Error in enrich-selected API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 