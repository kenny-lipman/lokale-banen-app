import { NextRequest, NextResponse } from "next/server"
import { companyEnrichmentService } from "@/lib/company-enrichment-service"
import { performanceMonitor } from "@/lib/performance-monitoring"

/**
 * Apollo Enrichment Result Webhook Handler
 * 
 * This endpoint processes enrichment results from Apollo and updates
 * company data and enrichment status in the database.
 */

export async function POST(req: NextRequest) {
  const startTime = performance.now()
  
  try {
    // Get request body
    const body = await req.json()
    
    // Log the incoming webhook
    console.log('📥 Apollo enrichment result received:', {
      timestamp: new Date().toISOString(),
      company_id: body.company_id,
      batch_id: body.batch_id,
      success: body.success
    })

    // Validate the incoming data
    const validation = companyEnrichmentService.validateEnrichmentData(body)
    if (!validation.valid) {
      console.error('❌ Invalid enrichment data:', validation.errors)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid data',
          details: validation.errors 
        },
        { status: 400 }
      )
    }

    // Process the enrichment result
    const result = await companyEnrichmentService.processEnrichmentResult({
      company_id: body.company_id,
      batch_id: body.batch_id,
      success: body.success,
      contacts_found: body.contacts_found || 0,
      enrichment_data: body.enrichment_data,
      error_message: body.error_message
    })

    if (!result.success) {
      console.error('❌ Failed to process enrichment result:', result.error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Processing failed',
          details: result.error 
        },
        { status: 500 }
      )
    }

    // triggerRealTimeUpdate removed from CompanyEnrichmentService

    // Record performance metrics
    const processingTime = performance.now() - startTime
    performanceMonitor.recordAPICall({
      endpoint: '/api/webhooks/apollo-result',
      method: 'POST',
      statusCode: 200,
      responseTime: processingTime,
      requestSize: JSON.stringify(body).length,
      responseSize: 0, // We'll calculate this below
      userId: undefined,
      userAgent: req.headers.get('user-agent') || undefined
    })

    const response = {
      success: true,
      message: 'Enrichment result processed successfully',
      updated_records: result.updated_records,
      processing_time_ms: Math.round(processingTime * 100) / 100
    }

    console.log('✅ Apollo enrichment result processed:', {
      company_id: body.company_id,
      batch_id: body.batch_id,
      updated_records: result.updated_records,
      processing_time_ms: response.processing_time_ms
    })

    return NextResponse.json(response)

  } catch (error) {
    const processingTime = performance.now() - startTime
    
    console.error('❌ Apollo result webhook error:', error)
    
    // Record error metrics
    performanceMonitor.recordAPICall({
      endpoint: '/api/webhooks/apollo-result',
      method: 'POST',
      statusCode: 500,
      responseTime: processingTime,
      requestSize: 0,
      responseSize: 0
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    service: 'Apollo Result Webhook Handler',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
}

// Handle batch result processing
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { batch_id, results } = body

    if (!batch_id || !Array.isArray(results)) {
      return NextResponse.json(
        { error: 'batch_id and results array are required' },
        { status: 400 }
      )
    }

    console.log(`📦 Processing batch results for ${batch_id}: ${results.length} companies`)

    const processedResults = await Promise.all(
      results.map(async (result: any) => {
        try {
          const processed = await companyEnrichmentService.processEnrichmentResult({
            ...result,
            batch_id
          })
          return { company_id: result.company_id, ...processed }
        } catch (error) {
          console.error(`Error processing company ${result.company_id}:`, error)
          return {
            company_id: result.company_id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    const successCount = processedResults.filter(r => r.success).length
    const failureCount = processedResults.length - successCount

    console.log(`✅ Batch ${batch_id} processed: ${successCount} success, ${failureCount} failures`)

    return NextResponse.json({
      success: true,
      batch_id,
      processed_count: processedResults.length,
      success_count: successCount,
      failure_count: failureCount,
      results: processedResults
    })

  } catch (error) {
    console.error('❌ Batch processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}