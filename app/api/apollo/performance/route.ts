import { NextRequest, NextResponse } from "next/server"
import { performanceMonitor } from "@/lib/performance-monitoring"
import { cacheService } from "@/lib/cache-service"
import { apolloStatusService } from "@/lib/apollo-status-service"

export async function GET(req: NextRequest) {
  try {
    const timeWindow = parseInt(req.nextUrl.searchParams.get('window') || '300000') // 5 minutes default
    const format = req.nextUrl.searchParams.get('format') || 'json'

    if (format === 'prometheus') {
      const prometheusData = performanceMonitor.exportMetrics('prometheus')
      return new Response(prometheusData, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      })
    }

    // Get comprehensive performance data
    const performanceStats = performanceMonitor.getStats(timeWindow)
    const cacheStats = cacheService.getStats()
    const serviceMetrics = apolloStatusService.getMetrics()

    return NextResponse.json({
      success: true,
      data: {
        performance: performanceStats,
        cache: cacheStats,
        services: {
          apollo_status: serviceMetrics
        },
        system: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          nodeVersion: process.version
        }
      }
    })

  } catch (error) {
    console.error('Performance API error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// Performance control endpoints
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'clear_cache':
        cacheService.clear()
        return NextResponse.json({
          success: true,
          message: "Cache cleared successfully"
        })

      case 'cleanup_cache':
        const cleaned = cacheService.cleanup()
        return NextResponse.json({
          success: true,
          message: `Cleaned ${cleaned} expired cache entries`
        })

      case 'warm_cache':
        const { warmingData } = body
        if (warmingData && Array.isArray(warmingData)) {
          cacheService.warmCache(warmingData)
          return NextResponse.json({
            success: true,
            message: `Warmed cache with ${warmingData.length} entries`
          })
        }
        return NextResponse.json(
          { error: "Invalid warming data" },
          { status: 400 }
        )

      case 'reset_metrics':
        // Note: This would require adding a reset method to performance monitor
        return NextResponse.json({
          success: true,
          message: "Metrics reset (not implemented)"
        })

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Performance control error:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}