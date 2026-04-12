import { createClient } from "@/lib/supabase"
import { 
  classifyError, 
  calculateRetryDelay, 
  shouldTriggerCircuitBreaker,
  getUserFriendlyMessage,
  ErrorClassification,
  DEFAULT_RETRY_CONFIG 
} from "@/lib/error-classification"

export interface RetryAttempt {
  attempt: number
  error: any
  classification: ErrorClassification
  timestamp: string
  delay: number
}

export interface CircuitBreakerState {
  isOpen: boolean
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

export class ApolloRetryService {
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 minute
  
  private get client() {
    return createClient()
  }

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      batchId: string
      companyId: string
      operationType: string
    }
  ): Promise<{ success: boolean; result?: T; error?: any; attempts: RetryAttempt[] }> {
    const attempts: RetryAttempt[] = []
    let lastError: any

    // Check circuit breaker
    if (this.isCircuitBreakerOpen(context.operationType)) {
      const error = new Error('Circuit breaker is open - service temporarily unavailable')
      const classification = classifyError(error)
      
      await this.logRetryAttempt(context.batchId, context.companyId, {
        attempt: 1,
        error,
        classification,
        timestamp: new Date().toISOString(),
        delay: 0
      })

      return {
        success: false,
        error: error,
        attempts: [{
          attempt: 1,
          error,
          classification,
          timestamp: new Date().toISOString(),
          delay: 0
        }]
      }
    }

    for (let attempt = 1; attempt <= DEFAULT_RETRY_CONFIG.maxRetries + 1; attempt++) {
      try {
        // Execute the operation
        const result = await operation()
        
        // Success - reset circuit breaker
        this.resetCircuitBreaker(context.operationType)
        
        // Log successful retry if there were previous attempts
        if (attempts.length > 0) {
          await this.updateRetrySuccess(context.batchId, context.companyId, attempt)
        }

        return { success: true, result, attempts }

      } catch (error) {
        lastError = error
        const classification = classifyError(error)
        const delay = calculateRetryDelay(attempt, classification.retryStrategy)
        
        const retryAttempt: RetryAttempt = {
          attempt,
          error,
          classification,
          timestamp: new Date().toISOString(),
          delay
        }
        
        attempts.push(retryAttempt)

        // Log the retry attempt
        await this.logRetryAttempt(context.batchId, context.companyId, retryAttempt)

        // Update circuit breaker
        if (shouldTriggerCircuitBreaker(classification)) {
          this.recordFailure(context.operationType)
        }

        // Check if we should retry
        if (!classification.retryable || attempt > classification.maxRetries) {
          break
        }

        // Wait before retry
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    await this.updateRetryFailure(context.batchId, context.companyId, attempts)
    
    return {
      success: false,
      error: lastError,
      attempts
    }
  }

  /**
   * Log retry attempt to database
   */
  private async logRetryAttempt(
    batchId: string, 
    companyId: string, 
    attempt: RetryAttempt
  ): Promise<void> {
    try {
      // Get batch ID from database
      const { data: batch } = await this.client
        .from('enrichment_batches')
        .select('id')
        .eq('batch_id', batchId)
        .single()

      if (!batch) return

      // Update enrichment_status with retry information
      await this.client
        .from('enrichment_status')
        .update({
          retry_count: attempt.attempt,
          last_retry_at: attempt.timestamp,
          error_message: getUserFriendlyMessage(attempt.classification, attempt.attempt),
          failure_reason: attempt.classification.category,
          updated_at: attempt.timestamp
        })
        .eq('batch_id', batch.id)
        .eq('company_id', companyId)

    } catch (error) {
      console.error('Failed to log retry attempt:', error)
      // Don't throw - logging failure shouldn't break the retry process
    }
  }

  /**
   * Update retry success in database
   */
  private async updateRetrySuccess(
    batchId: string, 
    companyId: string, 
    finalAttempt: number
  ): Promise<void> {
    try {
      const { data: batch } = await this.client
        .from('enrichment_batches')
        .select('id')
        .eq('batch_id', batchId)
        .single()

      if (!batch) return

      await this.client
        .from('enrichment_status')
        .update({
          status: 'completed',
          retry_count: finalAttempt,
          error_message: null,
          failure_reason: null,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('batch_id', batch.id)
        .eq('company_id', companyId)

    } catch (error) {
      console.error('Failed to update retry success:', error)
    }
  }

  /**
   * Update retry failure in database
   */
  private async updateRetryFailure(
    batchId: string, 
    companyId: string, 
    attempts: RetryAttempt[]
  ): Promise<void> {
    try {
      const { data: batch } = await this.client
        .from('enrichment_batches')
        .select('id')
        .eq('batch_id', batchId)
        .single()

      if (!batch) return

      const lastAttempt = attempts[attempts.length - 1]
      
      await this.client
        .from('enrichment_status')
        .update({
          status: 'failed',
          retry_count: attempts.length,
          last_retry_at: lastAttempt.timestamp,
          error_message: getUserFriendlyMessage(lastAttempt.classification),
          failure_reason: lastAttempt.classification.category,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('batch_id', batch.id)
        .eq('company_id', companyId)

    } catch (error) {
      console.error('Failed to update retry failure:', error)
    }
  }

  /**
   * Circuit breaker methods
   */
  private isCircuitBreakerOpen(operationType: string): boolean {
    const state = this.circuitBreakers.get(operationType)
    if (!state) return false

    if (state.isOpen) {
      if (Date.now() > state.nextAttemptTime) {
        // Reset circuit breaker after timeout
        this.resetCircuitBreaker(operationType)
        return false
      }
      return true
    }

    return false
  }

  private recordFailure(operationType: string): void {
    const state = this.circuitBreakers.get(operationType) || {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }

    state.failureCount++
    state.lastFailureTime = Date.now()

    if (state.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true
      state.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT
      console.warn(`Circuit breaker opened for ${operationType} after ${state.failureCount} failures`)
    }

    this.circuitBreakers.set(operationType, state)
  }

  private resetCircuitBreaker(operationType: string): void {
    const state = this.circuitBreakers.get(operationType)
    if (state) {
      state.isOpen = false
      state.failureCount = 0
      state.lastFailureTime = 0
      state.nextAttemptTime = 0
      this.circuitBreakers.set(operationType, state)
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    return Object.fromEntries(this.circuitBreakers.entries())
  }

  /**
   * Queue failed enrichment for later retry
   */
  async queueForRetry(
    batchId: string, 
    companyId: string, 
    retryAfter: number = 300000 // 5 minutes
  ): Promise<void> {
    try {
      // Implementation would depend on your job queue system
      // For now, we'll update the database with a retry schedule
      const { data: batch } = await this.client
        .from('enrichment_batches')
        .select('id')
        .eq('batch_id', batchId)
        .single()

      if (!batch) return

      await this.client
        .from('enrichment_status')
        .update({
          status: 'queued_for_retry',
          retry_scheduled_at: new Date(Date.now() + retryAfter).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('batch_id', batch.id)
        .eq('company_id', companyId)

    } catch (error) {
      console.error('Failed to queue for retry:', error)
    }
  }
}

// Export singleton instance
export const apolloRetryService = new ApolloRetryService()