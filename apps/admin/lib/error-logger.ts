import { NextRequest } from 'next/server'

export interface ErrorLogEntry {
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  context: {
    endpoint: string
    method: string
    ip?: string
    userAgent?: string
    userId?: string
    requestId?: string
  }
  metadata?: Record<string, any>
}

export interface ErrorLoggerConfig {
  enableConsoleLogging: boolean
  enableFileLogging: boolean
  enableDatabaseLogging: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
  maxLogEntries: number
}

// In-memory log store (for development - use database/file in production)
const logEntries: ErrorLogEntry[] = []

const DEFAULT_CONFIG: ErrorLoggerConfig = {
  enableConsoleLogging: true,
  enableFileLogging: false,
  enableDatabaseLogging: false,
  logLevel: 'info',
  maxLogEntries: 1000
}

class ErrorLogger {
  private config: ErrorLoggerConfig

  constructor(config: Partial<ErrorLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const configLevelIndex = levels.indexOf(this.config.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= configLevelIndex
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  private extractRequestInfo(request?: NextRequest) {
    if (!request) return {}
    
    return {
      endpoint: request.url || 'unknown',
      method: request.method || 'unknown',
      ip: request.headers.get('x-forwarded-for') || 
          request.headers.get('x-real-ip') || 
          'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      requestId: request.headers.get('x-request-id') || this.generateId()
    }
  }

  private createLogEntry(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    error?: Error,
    request?: NextRequest,
    metadata?: Record<string, any>
  ): ErrorLogEntry {
    return {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      context: {
        ...this.extractRequestInfo(request),
        userId: request?.headers.get('x-user-id') || undefined
      },
      metadata
    }
  }

  private writeToConsole(entry: ErrorLogEntry) {
    if (!this.config.enableConsoleLogging) return

    const timestamp = new Date(entry.timestamp).toISOString()
    const context = `[${entry.context.method}] ${entry.context.endpoint}`
    
    switch (entry.level) {
      case 'error':
        console.error(`🔴 ${timestamp} ERROR ${context}: ${entry.message}`, entry.error?.stack)
        break
      case 'warn':
        console.warn(`🟡 ${timestamp} WARN ${context}: ${entry.message}`)
        break
      case 'info':
        console.info(`🔵 ${timestamp} INFO ${context}: ${entry.message}`)
        break
      case 'debug':
        console.debug(`⚪ ${timestamp} DEBUG ${context}: ${entry.message}`)
        break
    }

    if (entry.metadata) {
      console.log('Metadata:', entry.metadata)
    }
  }

  private writeToMemory(entry: ErrorLogEntry) {
    logEntries.push(entry)
    
    // Keep only the most recent entries
    if (logEntries.length > this.config.maxLogEntries) {
      logEntries.splice(0, logEntries.length - this.config.maxLogEntries)
    }
  }

  private async writeToDatabase(entry: ErrorLogEntry) {
    if (!this.config.enableDatabaseLogging) return

    try {
      // This would be implemented with your database of choice
      // For now, we'll just store in memory
      this.writeToMemory(entry)
    } catch (error) {
      console.error('Failed to write log to database:', error)
    }
  }

  public log(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    error?: Error,
    request?: NextRequest,
    metadata?: Record<string, any>
  ) {
    if (!this.shouldLog(level)) return

    const entry = this.createLogEntry(level, message, error, request, metadata)
    
    this.writeToConsole(entry)
    this.writeToMemory(entry)
    this.writeToDatabase(entry)
  }

  public error(message: string, error?: Error, request?: NextRequest, metadata?: Record<string, any>) {
    this.log('error', message, error, request, metadata)
  }

  public warn(message: string, request?: NextRequest, metadata?: Record<string, any>) {
    this.log('warn', message, undefined, request, metadata)
  }

  public info(message: string, request?: NextRequest, metadata?: Record<string, any>) {
    this.log('info', message, undefined, request, metadata)
  }

  public debug(message: string, request?: NextRequest, metadata?: Record<string, any>) {
    this.log('debug', message, undefined, request, metadata)
  }

  // Get recent log entries
  public getRecentLogs(limit: number = 100, level?: string): ErrorLogEntry[] {
    let filtered = logEntries
    
    if (level) {
      filtered = logEntries.filter(entry => entry.level === level)
    }
    
    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  // Get error statistics
  public getErrorStats(timeframe: number = 24): {
    total: number
    by_level: Record<string, number>
    by_endpoint: Record<string, number>
    recent_errors: ErrorLogEntry[]
  } {
    const cutoff = new Date(Date.now() - timeframe * 60 * 60 * 1000)
    const recentLogs = logEntries.filter(entry => new Date(entry.timestamp) >= cutoff)
    
    const byLevel = recentLogs.reduce((acc, entry) => {
      acc[entry.level] = (acc[entry.level] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const byEndpoint = recentLogs.reduce((acc, entry) => {
      const endpoint = entry.context.endpoint
      acc[endpoint] = (acc[endpoint] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      total: recentLogs.length,
      by_level: byLevel,
      by_endpoint: byEndpoint,
      recent_errors: recentLogs.filter(entry => entry.level === 'error').slice(0, 10)
    }
  }
}

// Default logger instance
export const logger = new ErrorLogger()

// API endpoint specific loggers
export const contactLogger = new ErrorLogger({
  enableConsoleLogging: true,
  logLevel: 'info'
})

export const campaignLogger = new ErrorLogger({
  enableConsoleLogging: true,
  logLevel: 'info'
})

export const enrichmentLogger = new ErrorLogger({
  enableConsoleLogging: true,
  logLevel: 'debug'
})

// Middleware wrapper for automatic error logging
export function withErrorLogging(
  handler: (request: NextRequest) => Promise<Response> | Response,
  customLogger: ErrorLogger = logger
) {
  return async (request: NextRequest): Promise<Response> => {
    const startTime = Date.now()
    
    try {
      customLogger.info(`Request started`, request, {
        timestamp: new Date().toISOString()
      })
      
      const response = await handler(request)
      const duration = Date.now() - startTime
      
      if (response.status >= 400) {
        customLogger.warn(
          `Request completed with error status: ${response.status}`,
          request,
          { duration, status: response.status }
        )
      } else {
        customLogger.info(
          `Request completed successfully`,
          request,
          { duration, status: response.status }
        )
      }
      
      return response
      
    } catch (error) {
      const duration = Date.now() - startTime
      
      customLogger.error(
        `Request failed with exception`,
        error instanceof Error ? error : new Error(String(error)),
        request,
        { duration }
      )
      
      // Re-throw the error to maintain error handling behavior
      throw error
    }
  }
}

// Helper function to create structured error responses
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  error?: Error,
  request?: NextRequest,
  metadata?: Record<string, any>
) {
  // Log the error
  logger.error(message, error, request, metadata)
  
  // Create response
  const errorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    request_id: request?.headers.get('x-request-id') || 'unknown'
  }
  
  // Include error details in development
  if (process.env.NODE_ENV === 'development' && error) {
    (errorResponse as any).debug = {
      error_name: error.name,
      error_message: error.message,
      stack: error.stack
    }
  }
  
  return new Response(JSON.stringify(errorResponse), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json'
    }
  })
}