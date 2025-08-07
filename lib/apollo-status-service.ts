import { createClient } from "@/lib/supabase"
import { cacheService } from "@/lib/cache-service"
import { performanceMonitor } from "@/lib/performance-monitoring"

export interface BatchStatusResponse {
  success: boolean
  data: {
    batch_id: string
    status: "pending" | "processing" | "completed" | "failed" | "partial_success"
    total_companies: number
    completed_companies: number
    failed_companies: number
    started_at: string
    completed_at: string | null
    error_message: string | null
    company_results: Array<{
      company_id: string
      status: string
      apollo_contacts_count: number | null
      enriched_at: string | null
    }>
  }
}

export interface BatchStatusError {
  success: false
  error: string
  details?: string
}

export class ApolloStatusService {
  private get client() {
    return createClient()
  }

  /**
   * Get enrichment status for a batch with optimized database queries
   */
  async getBatchStatus(batchId: string): Promise<BatchStatusResponse | BatchStatusError> {
    const cacheKey = cacheService.constructor.getBatchKey(batchId)
    
    return performanceMonitor.timeFunction(
      'apollo_status_service.getBatchStatus',
      async () => {
        // Check cache first
        const cached = cacheService.get<BatchStatusResponse>(cacheKey)
        if (cached) {
          performanceMonitor.recordMetric({
            name: 'cache_hit',
            value: 1,
            unit: 'count',
            tags: { service: 'apollo_status', operation: 'getBatchStatus' }
          })
          return cached
        }

        performanceMonitor.recordMetric({
          name: 'cache_miss',
          value: 1,
          unit: 'count',
          tags: { service: 'apollo_status', operation: 'getBatchStatus' }
        })
        
        try {

          // Single optimized query to get batch and enrichment status data
          const { data: batchData, error: batchError } = await this.client
            .from('enrichment_batches')
            .select(`
              id,
              batch_id,
              status,
              total_companies,
              completed_companies,
              failed_companies,
              started_at,
              completed_at,
              error_message,
              enrichment_status (
                company_id,
                status,
                processing_completed_at,
                companies (
                  apollo_contacts_count,
                  apollo_enriched_at
                )
              )
            `)
            .eq('batch_id', batchId)
            .single()

          if (batchError) {
            if (batchError.code === 'PGRST116') {
              return {
                success: false,
                error: "Batch not found"
              }
            }
            console.error('Error fetching batch status:', batchError)
            return {
              success: false,
              error: "Failed to fetch batch information",
              details: batchError.message
            }
          }

          // Process company results
          const companyResults = (batchData.enrichment_status || []).map((status: any) => ({
            company_id: status.company_id,
            status: status.status,
            apollo_contacts_count: status.companies?.apollo_contacts_count || null,
            enriched_at: status.companies?.apollo_enriched_at || null
          }))

          const response: BatchStatusResponse = {
            success: true,
            data: {
              batch_id: batchData.batch_id,
              status: batchData.status,
              total_companies: batchData.total_companies,
              completed_companies: batchData.completed_companies,
              failed_companies: batchData.failed_companies,
              started_at: batchData.started_at,
              completed_at: batchData.completed_at,
              error_message: batchData.error_message,
              company_results: companyResults
            }
          }

          // Cache based on batch status
          if (batchData.status === 'completed' || batchData.status === 'failed') {
            cacheService.set(cacheKey, response, 'enrichment_completed')
          } else {
            cacheService.set(cacheKey, response, 'enrichment_active')
          }

          return response

        } catch (error) {
          console.error('Apollo status service error:', error)
          return {
            success: false,
            error: "Internal server error",
            details: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      },
      { batchId }
    )
  }

  /**
   * Get lightweight status for polling - only essential fields
   */
  async getLightweightBatchStatus(batchId: string): Promise<BatchStatusResponse | BatchStatusError> {
    const cacheKey = cacheService.constructor.getStatusKey(batchId, true)
    
    return performanceMonitor.timeFunction(
      'apollo_status_service.getLightweightBatchStatus',
      async () => {
        // Check cache first
        const cached = cacheService.get<BatchStatusResponse>(cacheKey)
        if (cached) {
          performanceMonitor.recordMetric({
            name: 'cache_hit',
            value: 1,
            unit: 'count',
            tags: { service: 'apollo_status', operation: 'getLightweightBatchStatus' }
          })
          return cached
        }

        try {
          // For active polling, we need a lighter query
          const { data: batchData, error: batchError } = await this.client
            .from('enrichment_batches')
            .select(`
              batch_id,
              status,
              total_companies,
              completed_companies,
              failed_companies,
              started_at,
              completed_at,
              error_message
            `)
            .eq('batch_id', batchId)
            .single()

          if (batchError) {
            if (batchError.code === 'PGRST116') {
              return {
                success: false,
                error: "Batch not found"
              }
            }
            return {
              success: false,
              error: "Failed to fetch batch information"
            }
          }

          const response: BatchStatusResponse = {
            success: true,
            data: {
              batch_id: batchData.batch_id,
              status: batchData.status,
              total_companies: batchData.total_companies,
              completed_companies: batchData.completed_companies,
              failed_companies: batchData.failed_companies,
              started_at: batchData.started_at,
              completed_at: batchData.completed_at,
              error_message: batchData.error_message,
              company_results: [] // Empty for lightweight response
            }
          }

          // Cache with shorter TTL for lightweight responses
          cacheService.set(cacheKey, response, 'batch_status')
          
          return response

        } catch (error) {
          console.error('Apollo lightweight status error:', error)
          return {
            success: false,
            error: "Internal server error"
          }
        }
      },
      { batchId, lightweight: 'true' }
    )
  }

  /**
   * Clear cache for a specific batch (used when status is updated)
   */
  clearCache(batchId: string): void {
    const batchKey = cacheService.constructor.getBatchKey(batchId)
    const statusKey = cacheService.constructor.getStatusKey(batchId, false)
    const lightStatusKey = cacheService.constructor.getStatusKey(batchId, true)
    
    cacheService.delete(batchKey)
    cacheService.delete(statusKey)
    cacheService.delete(lightStatusKey)
  }

  /**
   * Get service performance metrics
   */
  getMetrics(): {
    cacheStats: any
    performanceStats: any
  } {
    return {
      cacheStats: cacheService.getStats(),
      performanceStats: performanceMonitor.getStats()
    }
  }
}

// Export singleton instance
export const apolloStatusService = new ApolloStatusService()