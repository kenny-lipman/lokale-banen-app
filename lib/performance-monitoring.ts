export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percentage'
  timestamp: number
  tags?: Record<string, string>
}

export interface APIPerformanceData {
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  requestSize: number
  responseSize: number
  timestamp: number
  userId?: string
  userAgent?: string
  cacheHit?: boolean
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private apiCalls: APIPerformanceData[] = []
  private readonly MAX_METRICS = 1000
  private readonly MAX_API_CALLS = 500

  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS)
    }
  }

  /**
   * Record API call performance
   */
  recordAPICall(data: Omit<APIPerformanceData, 'timestamp'>): void {
    const fullData: APIPerformanceData = {
      ...data,
      timestamp: Date.now()
    }

    this.apiCalls.push(fullData)

    // Keep only recent API calls
    if (this.apiCalls.length > this.MAX_API_CALLS) {
      this.apiCalls = this.apiCalls.slice(-this.MAX_API_CALLS)
    }
  }

  /**
   * Time a function execution
   */
  async timeFunction<T>(
    name: string, 
    fn: () => Promise<T>, 
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - start
      
      this.recordMetric({
        name: `function_execution_time.${name}`,
        value: duration,
        unit: 'ms',
        tags: { ...tags, status: 'success' }
      })
      
      return result
    } catch (error) {
      const duration = performance.now() - start
      
      this.recordMetric({
        name: `function_execution_time.${name}`,
        value: duration,
        unit: 'ms',
        tags: { ...tags, status: 'error' }
      })
      
      throw error
    }
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindow: number = 300000): {
    metrics: {
      avgResponseTime: number
      p95ResponseTime: number
      errorRate: number
      requestCount: number
      cacheHitRate: number
    }
    apiEndpoints: Array<{
      endpoint: string
      avgResponseTime: number
      requestCount: number
      errorCount: number
    }>
    systemMetrics: {
      memoryUsage: number
      activeConnections: number
    }
  } {
    const cutoff = Date.now() - timeWindow
    const recentAPICalls = this.apiCalls.filter(call => call.timestamp > cutoff)
    const recentMetrics = this.metrics.filter(metric => metric.timestamp > cutoff)

    // Calculate API metrics
    const responseTimes = recentAPICalls.map(call => call.responseTime)
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0

    const sortedResponseTimes = responseTimes.sort((a, b) => a - b)
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95)
    const p95ResponseTime = sortedResponseTimes[p95Index] || 0

    const errorCount = recentAPICalls.filter(call => call.statusCode >= 400).length
    const errorRate = recentAPICalls.length > 0 
      ? (errorCount / recentAPICalls.length) * 100 
      : 0

    const cacheHits = recentAPICalls.filter(call => call.cacheHit).length
    const cacheHitRate = recentAPICalls.length > 0 
      ? (cacheHits / recentAPICalls.length) * 100 
      : 0

    // Group by endpoint
    const endpointStats = new Map<string, { times: number[], errors: number }>()
    recentAPICalls.forEach(call => {
      const key = `${call.method} ${call.endpoint}`
      const stats = endpointStats.get(key) || { times: [], errors: 0 }
      stats.times.push(call.responseTime)
      if (call.statusCode >= 400) {
        stats.errors++
      }
      endpointStats.set(key, stats)
    })

    const apiEndpoints = Array.from(endpointStats.entries()).map(([endpoint, stats]) => ({
      endpoint,
      avgResponseTime: stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length,
      requestCount: stats.times.length,
      errorCount: stats.errors
    }))

    // System metrics
    const memoryMetrics = recentMetrics.filter(m => m.name.includes('memory'))
    const avgMemoryUsage = memoryMetrics.length > 0
      ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length
      : 0

    return {
      metrics: {
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        requestCount: recentAPICalls.length,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      },
      apiEndpoints: apiEndpoints.sort((a, b) => b.requestCount - a.requestCount),
      systemMetrics: {
        memoryUsage: Math.round(avgMemoryUsage),
        activeConnections: 0 // Would need actual tracking
      }
    }
  }

  /**
   * Get metrics by name
   */
  getMetricsByName(name: string, timeWindow: number = 300000): PerformanceMetric[] {
    const cutoff = Date.now() - timeWindow
    return this.metrics.filter(metric => 
      metric.name === name && metric.timestamp > cutoff
    )
  }

  /**
   * Clear old metrics
   */
  cleanup(maxAge: number = 3600000): void {
    const cutoff = Date.now() - maxAge
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoff)
    this.apiCalls = this.apiCalls.filter(call => call.timestamp > cutoff)
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.toPrometheusFormat()
    }
    
    return JSON.stringify({
      metrics: this.metrics,
      apiCalls: this.apiCalls,
      timestamp: Date.now()
    })
  }

  private toPrometheusFormat(): string {
    const lines: string[] = []
    
    // Group metrics by name
    const metricGroups = new Map<string, PerformanceMetric[]>()
    this.metrics.forEach(metric => {
      const group = metricGroups.get(metric.name) || []
      group.push(metric)
      metricGroups.set(metric.name, group)
    })

    metricGroups.forEach((metrics, name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_')
      lines.push(`# TYPE ${safeName} gauge`)
      
      metrics.forEach(metric => {
        const tags = metric.tags 
          ? Object.entries(metric.tags).map(([k, v]) => `${k}="${v}"`).join(',')
          : ''
        const tagStr = tags ? `{${tags}}` : ''
        lines.push(`${safeName}${tagStr} ${metric.value} ${metric.timestamp}`)
      })
    })

    return lines.join('\n')
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Auto cleanup every hour
setInterval(() => {
  performanceMonitor.cleanup()
}, 3600000)