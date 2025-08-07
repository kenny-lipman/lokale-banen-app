import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { apolloRetryService } from "@/lib/apollo-retry-service"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    // Get retry statistics from database function
    const { data: stats, error } = await supabase
      .rpc('get_retry_statistics')
      .single()

    if (error) {
      console.error('Error fetching retry statistics:', error)
      return NextResponse.json(
        { error: "Failed to fetch retry statistics" },
        { status: 500 }
      )
    }

    // Get circuit breaker status
    const circuitBreakerStatus = apolloRetryService.getCircuitBreakerStatus()

    // Get recent failed enrichments
    const { data: recentFailures, error: failuresError } = await supabase
      .from('enrichment_status')
      .select(`
        company_id,
        status,
        retry_count,
        failure_reason,
        last_retry_at,
        error_message
      `)
      .eq('status', 'failed')
      .gt('retry_count', 0)
      .order('last_retry_at', { ascending: false })
      .limit(10)

    if (failuresError) {
      console.error('Error fetching recent failures:', failuresError)
    }

    return NextResponse.json({
      success: true,
      data: {
        statistics: stats,
        circuitBreakers: circuitBreakerStatus,
        recentFailures: recentFailures || [],
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Retry stats API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'schedule_retries') {
      const supabase = createClient()
      
      // Call the database function to schedule retries
      const { data: result, error } = await supabase
        .rpc('schedule_retry_enrichments')

      if (error) {
        console.error('Error scheduling retries:', error)
        return NextResponse.json(
          { error: "Failed to schedule retries" },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Scheduled ${result} enrichments for retry`,
        count: result
      })
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )

  } catch (error) {
    console.error('Retry stats POST error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}