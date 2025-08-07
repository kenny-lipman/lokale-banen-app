export interface ErrorClassification {
  type: 'network' | 'validation' | 'service' | 'unknown'
  category: string
  retryable: boolean
  retryStrategy: 'exponential_backoff' | 'delayed_retry' | 'none'
  maxRetries: number
  delay?: number
  userMessage: string
}

export interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2
}

/**
 * Classify errors and determine retry strategy
 */
export function classifyError(error: any): ErrorClassification {
  const errorMessage = error?.message || error?.toString() || 'Unknown error'
  const errorCode = error?.code || error?.status || error?.statusCode

  // Network errors
  if (
    errorMessage.includes('FETCH_FAILED') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('ECONNRESET') ||
    errorCode === 'NETWORK_ERROR'
  ) {
    return {
      type: 'network',
      category: 'NETWORK_ERROR',
      retryable: true,
      retryStrategy: 'exponential_backoff',
      maxRetries: 3,
      userMessage: 'Network connection issue. Retrying automatically...'
    }
  }

  // Validation errors
  if (
    errorMessage.includes('INVALID_WEBSITE') ||
    errorMessage.includes('MISSING_COMPANY') ||
    errorMessage.includes('BAD_REQUEST') ||
    errorCode === 400 ||
    errorCode === 422
  ) {
    return {
      type: 'validation',
      category: 'VALIDATION_ERROR',
      retryable: false,
      retryStrategy: 'none',
      maxRetries: 0,
      userMessage: 'Invalid data provided. Please check the company information and try again.'
    }
  }

  // Service errors
  if (
    errorMessage.includes('APOLLO_API_DOWN') ||
    errorMessage.includes('RATE_LIMITED') ||
    errorMessage.includes('SERVER_ERROR') ||
    errorCode === 429 ||
    errorCode === 502 ||
    errorCode === 503 ||
    errorCode === 504
  ) {
    return {
      type: 'service',
      category: 'SERVICE_ERROR',
      retryable: true,
      retryStrategy: 'delayed_retry',
      maxRetries: 2,
      delay: 5000, // 5 seconds
      userMessage: 'Service temporarily unavailable. Retrying in a few seconds...'
    }
  }

  // Apollo specific errors
  if (errorMessage.includes('Apollo') || errorMessage.includes('apollo')) {
    return {
      type: 'service',
      category: 'APOLLO_SERVICE_ERROR',
      retryable: true,
      retryStrategy: 'exponential_backoff',
      maxRetries: 2,
      userMessage: 'Apollo service issue. Retrying automatically...'
    }
  }

  // Database errors
  if (
    errorMessage.includes('database') ||
    errorMessage.includes('PGRST') ||
    errorCode === 'PGRST500'
  ) {
    return {
      type: 'service',
      category: 'DATABASE_ERROR',
      retryable: true,
      retryStrategy: 'exponential_backoff',
      maxRetries: 2,
      userMessage: 'Database connection issue. Retrying automatically...'
    }
  }

  // Timeout errors
  if (errorMessage.includes('timeout') || errorCode === 'TIMEOUT') {
    return {
      type: 'network',
      category: 'TIMEOUT_ERROR',
      retryable: true,
      retryStrategy: 'exponential_backoff',
      maxRetries: 3,
      userMessage: 'Request timed out. Retrying with longer timeout...'
    }
  }

  // Default unknown error
  return {
    type: 'unknown',
    category: 'UNKNOWN_ERROR',
    retryable: true,
    retryStrategy: 'exponential_backoff',
    maxRetries: 1,
    userMessage: 'An unexpected error occurred. Retrying once...'
  }
}

/**
 * Calculate retry delay based on strategy
 */
export function calculateRetryDelay(
  attempt: number, 
  strategy: string, 
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  customDelay?: number
): number {
  if (customDelay) {
    return customDelay
  }

  switch (strategy) {
    case 'exponential_backoff':
      const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1)
      return Math.min(delay, config.maxDelay)
    
    case 'delayed_retry':
      return config.baseDelay
    
    case 'none':
    default:
      return 0
  }
}

/**
 * Check if an error should trigger circuit breaker
 */
export function shouldTriggerCircuitBreaker(classification: ErrorClassification): boolean {
  return classification.type === 'service' && (
    classification.category === 'APOLLO_SERVICE_ERROR' ||
    classification.category === 'SERVICE_ERROR'
  )
}

/**
 * Generate user-friendly error message
 */
export function getUserFriendlyMessage(classification: ErrorClassification, attempt?: number): string {
  if (attempt && attempt > 1) {
    return `${classification.userMessage} (Attempt ${attempt})`
  }
  return classification.userMessage
}