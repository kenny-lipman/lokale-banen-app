import { NextRequest, NextResponse } from "next/server"
import { apolloStatusService } from "@/lib/apollo-status-service"
import { statusApiLimiter } from "@/middleware/rate-limiting"
import { performanceMonitor } from "@/lib/performance-monitoring"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const startTime = performance.now()
  let responseStatus = 200
  let cacheHit = false

  try {
    const { batchId } = await params

    if (!batchId) {
      responseStatus = 400
      return NextResponse.json(
        { error: "batchId parameter is required" },
        { status: 400 }
      )
    }

    // Enhanced rate limiting
    const rateLimitResult = await statusApiLimiter.checkLimit(req)
    if (!rateLimitResult.allowed) {
      responseStatus = 429
      const response = NextResponse.json(
        { 
          error: "Rate limit exceeded",
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        },
        { status: 429 }
      )
      
      // Add rate limit headers
      Object.entries({
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
      }).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      return response
    }

    // Check if lightweight polling is requested (for frequent polls)
    const lightweight = req.nextUrl.searchParams.get('lightweight') === 'true'
    
    // Use optimized service layer
    const result = lightweight 
      ? await apolloStatusService.getLightweightBatchStatus(batchId)
      : await apolloStatusService.getBatchStatus(batchId)

    if (!result.success) {
      responseStatus = result.error === "Batch not found" ? 404 : 500
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: responseStatus }
      )
    }

    // Check if response came from cache (would need to be implemented in service)
    cacheHit = false // This would be set by the service layer

    // Add response headers for performance
    const response = NextResponse.json(result.data)
    
    // Cache headers for completed batches
    if (result.data.status === 'completed' || result.data.status === 'failed') {
      response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=30')
    } else {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
    
    // Add performance and rate limit headers
    const processingTime = performance.now() - startTime
    response.headers.set('X-Response-Time', processingTime.toFixed(2))
    response.headers.set('X-Cache', cacheHit ? 'HIT' : 'MISS')
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    
    return response

  } catch (error) {
    console.error('Status API error:', error)
    responseStatus = 500
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  } finally {
    // Record API performance metrics
    const processingTime = performance.now() - startTime
    performanceMonitor.recordAPICall({
      endpoint: '/api/apollo/status/[batchId]',
      method: 'GET',
      statusCode: responseStatus,
      responseTime: processingTime,
      requestSize: req.headers.get('content-length') ? parseInt(req.headers.get('content-length')!) : 0,
      responseSize: 0, // Would be calculated from response
      userAgent: req.headers.get('user-agent') || undefined,
      cacheHit
    })
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