export class OtisErrorHandler {
  static handle(error: any, context: string): any {
    console.error(`Otis Error [${context}]:`, error)
    
    // Supabase specific errors
    if (error.code === '42501') {
      return { type: 'auth', message: 'Row-level security policy violation - authentication required', retry: false }
    }
    
    if (error.code === '23505') {
      return { type: 'validation', message: 'Duplicate entry - this record already exists', retry: false }
    }
    
    if (error.code === '42P01') {
      return { type: 'database', message: 'Table does not exist', retry: false }
    }
    
    // General error categories
    if (error.code === 'NETWORK_ERROR') {
      return { type: 'network', message: 'Connection failed', retry: true }
    }
    
    if (error.code === 'VALIDATION_ERROR') {
      return { type: 'validation', message: 'Invalid data provided', retry: false }
    }
    
    if (error.code === 'AUTH_ERROR') {
      return { type: 'auth', message: 'Authentication required', retry: false }
    }

    if (error.code === 'RATE_LIMIT_ERROR') {
      return { type: 'rate_limit', message: 'Too many requests', retry: true }
    }

    if (error.code === 'DATABASE_ERROR') {
      return { type: 'database', message: 'Database operation failed', retry: true }
    }
    
    // Return original error details for debugging
    return { 
      type: 'unknown', 
      message: error.message || 'An unexpected error occurred', 
      retry: true,
      details: error
    }
  }

  static logError(error: any, context: string, userId?: string): void {
    // TODO: Implement error logging
    console.error(`[${context}] Error for user ${userId}:`, error)
  }

  static isRetryable(error: any): boolean {
    const handledError = this.handle(error, 'retry_check')
    return handledError.retry
  }

  static getErrorMessage(error: any): string {
    const handledError = this.handle(error, 'message_extraction')
    return handledError.message
  }
} 