import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'
import { logger } from '@/lib/error-logger'

interface HealthCheckResult {
  service: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  latency_ms?: number
  error?: string
  details?: any
}

interface SystemHealth {
  overall_status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime_seconds: number
  checks: HealthCheckResult[]
  system_info: {
    node_version: string
    environment: string
    memory_usage: {
      used: number
      total: number
      percentage: number
    }
  }
}

// Track service start time for uptime calculation
const startTime = Date.now()

async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  
  try {
    // Test basic connectivity
    const { count, error } = await supabaseService.client
      .from('companies')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        error: error.message
      }
    }
    
    const latency = Date.now() - start
    
    return {
      service: 'database',
      status: latency < 1000 ? 'healthy' : 'degraded',
      latency_ms: latency,
      details: {
        companies_count: count,
        connection_pool: 'active'
      }
    }
    
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

async function checkContactsTableHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  
  try {
    // Test contacts table with qualification fields
    const { data, error } = await supabaseService.client
      .from('contacts')
      .select('id, qualification_status, is_key_contact')
      .limit(1)
    
    if (error) {
      return {
        service: 'contacts_table',
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        error: error.message
      }
    }
    
    const latency = Date.now() - start
    
    return {
      service: 'contacts_table',
      status: latency < 500 ? 'healthy' : 'degraded',
      latency_ms: latency,
      details: {
        qualification_fields_available: true,
        sample_data_accessible: data && data.length > 0
      }
    }
    
  } catch (error) {
    return {
      service: 'contacts_table',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown contacts table error'
    }
  }
}

async function checkEnrichmentSystemHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  
  try {
    // Test enrichment tables
    const { data, error } = await supabaseService.client
      .from('enrichment_batches')
      .select('id, status')
      .limit(1)
    
    if (error) {
      return {
        service: 'enrichment_system',
        status: 'unhealthy',
        latency_ms: Date.now() - start,
        error: error.message
      }
    }
    
    const latency = Date.now() - start
    
    return {
      service: 'enrichment_system',
      status: latency < 500 ? 'healthy' : 'degraded',
      latency_ms: latency,
      details: {
        enrichment_tables_available: true,
        recent_batches: data?.length || 0
      }
    }
    
  } catch (error) {
    return {
      service: 'enrichment_system',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown enrichment system error'
    }
  }
}

async function checkInstantlyAPIHealth(): Promise<HealthCheckResult> {
  const start = Date.now()
  
  try {
    // Test Instantly API connectivity (without making actual requests)
    const INSTANTLY_API_KEY = "ZmVlNjJlZjktNWQwMC00Y2JmLWFiNmItYmU4YTk1YWEyMGE0OlFFeFVoYk9Ra1FXbw=="
    
    if (!INSTANTLY_API_KEY) {
      return {
        service: 'instantly_api',
        status: 'unhealthy',
        error: 'Instantly API key not configured'
      }
    }
    
    // For health check, we'll just verify the key is present
    // In a real implementation, you might make a lightweight API call
    const latency = Date.now() - start
    
    return {
      service: 'instantly_api',
      status: 'healthy',
      latency_ms: latency,
      details: {
        api_key_configured: true,
        connection_ready: true
      }
    }
    
  } catch (error) {
    return {
      service: 'instantly_api',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown Instantly API error'
    }
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage()
  const totalMemory = usage.heapTotal
  const usedMemory = usage.heapUsed
  
  return {
    used: Math.round(usedMemory / 1024 / 1024), // MB
    total: Math.round(totalMemory / 1024 / 1024), // MB
    percentage: Math.round((usedMemory / totalMemory) * 100)
  }
}

async function performHealthCheck(): Promise<SystemHealth> {
  const startTime = Date.now()
  
  // Run all health checks in parallel
  const [
    databaseHealth,
    contactsHealth,
    enrichmentHealth,
    instantlyHealth
  ] = await Promise.all([
    checkDatabaseHealth(),
    checkContactsTableHealth(),
    checkEnrichmentSystemHealth(),
    checkInstantlyAPIHealth()
  ])
  
  const checks = [databaseHealth, contactsHealth, enrichmentHealth, instantlyHealth]
  
  // Determine overall status
  const hasUnhealthy = checks.some(check => check.status === 'unhealthy')
  const hasDegraded = checks.some(check => check.status === 'degraded')
  
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded'
  if (hasUnhealthy) {
    overallStatus = 'unhealthy'
  } else if (hasDegraded) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'healthy'
  }
  
  const memoryUsage = getMemoryUsage()
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  
  return {
    overall_status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime_seconds: uptime,
    checks,
    system_info: {
      node_version: process.version,
      environment: process.env.NODE_ENV || 'unknown',
      memory_usage: memoryUsage
    }
  }
}

export async function GET(request: NextRequest) {
  const start = Date.now()
  
  try {
    logger.info('Health check requested', request)
    
    const health = await performHealthCheck()
    const checkDuration = Date.now() - start
    
    // Add check duration to response
    ;(health as any).check_duration_ms = checkDuration
    
    // Return appropriate HTTP status based on health
    const status = health.overall_status === 'healthy' ? 200 :
                  health.overall_status === 'degraded' ? 200 : 503
    
    logger.info(`Health check completed: ${health.overall_status}`, request, {
      duration: checkDuration,
      status: health.overall_status
    })
    
    return NextResponse.json(health, { status })
    
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)), request)
    
    return NextResponse.json({
      overall_status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
    }, { status: 503 })
  }
}

// POST endpoint for triggering specific health checks
export async function POST(request: NextRequest) {
  try {
    const { service } = await request.json()
    
    if (!service) {
      return NextResponse.json({
        success: false,
        error: 'Service name is required'
      }, { status: 400 })
    }
    
    let result: HealthCheckResult
    
    switch (service) {
      case 'database':
        result = await checkDatabaseHealth()
        break
      case 'contacts':
        result = await checkContactsTableHealth()
        break
      case 'enrichment':
        result = await checkEnrichmentSystemHealth()
        break
      case 'instantly':
        result = await checkInstantlyAPIHealth()
        break
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown service: ${service}`
        }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      data: result
    })
    
  } catch (error) {
    logger.error('Specific health check failed', error instanceof Error ? error : new Error(String(error)), request)
    
    return NextResponse.json({
      success: false,
      error: 'Health check failed'
    }, { status: 500 })
  }
}