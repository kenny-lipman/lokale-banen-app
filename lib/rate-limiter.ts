import { NextRequest } from 'next/server'

// In-memory store for rate limiting (for development)
// In production, you should use Redis or a database
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests allowed in the window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
  keyGenerator?: (request: NextRequest) => string // Custom key generator
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  message?: string
}

// Default configuration
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later'
}

// Generate key for rate limiting
function generateKey(request: NextRequest, keyGenerator?: (req: NextRequest) => string): string {
  if (keyGenerator) {
    return keyGenerator(request)
  }
  
  // Default: use IP address
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  
  return `rate_limit:${ip}`
}

// Clean up expired entries
function cleanupExpired() {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (now >= data.resetTime) {
      requestCounts.delete(key)
    }
  }
}

// Rate limiter implementation
export function rateLimit(config: Partial<RateLimitConfig> = {}): (request: NextRequest) => RateLimitResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  
  return (request: NextRequest): RateLimitResult => {
    cleanupExpired()
    
    const key = generateKey(request, finalConfig.keyGenerator)
    const now = Date.now()
    const resetTime = now + finalConfig.windowMs
    
    // Get current count for this key
    const current = requestCounts.get(key)
    
    if (!current) {
      // First request from this key
      requestCounts.set(key, { count: 1, resetTime })
      return {
        success: true,
        limit: finalConfig.maxRequests,
        remaining: finalConfig.maxRequests - 1,
        resetTime
      }
    }
    
    // Check if window has expired
    if (now >= current.resetTime) {
      // Reset the counter
      requestCounts.set(key, { count: 1, resetTime })
      return {
        success: true,
        limit: finalConfig.maxRequests,
        remaining: finalConfig.maxRequests - 1,
        resetTime
      }
    }
    
    // Check if limit exceeded
    if (current.count >= finalConfig.maxRequests) {
      return {
        success: false,
        limit: finalConfig.maxRequests,
        remaining: 0,
        resetTime: current.resetTime,
        message: finalConfig.message
      }
    }
    
    // Increment counter
    current.count++
    
    return {
      success: true,
      limit: finalConfig.maxRequests,
      remaining: finalConfig.maxRequests - current.count,
      resetTime: current.resetTime
    }
  }
}

// Predefined rate limiters for different endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Too many API requests, please try again later'
})

export const strictRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes  
  maxRequests: 20, // 20 requests per 5 minutes
  message: 'Rate limit exceeded for this operation'
})

export const bulkOperationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 10, // 10 bulk operations per 10 minutes
  message: 'Too many bulk operations, please wait before trying again'
})

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 exports per hour
  message: 'Export limit exceeded, please try again later'
})

// User-specific rate limiter (requires authentication)
export const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 200, // 200 requests per 15 minutes per user
  keyGenerator: (request: NextRequest) => {
    // This would need to be implemented with actual user ID extraction
    const userId = request.headers.get('x-user-id') || 'anonymous'
    return `user_rate_limit:${userId}`
  }
})

// Helper function to create rate limit response
export function createRateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      success: false,
      error: result.message || 'Rate limit exceeded',
      rate_limit: {
        limit: result.limit,
        remaining: result.remaining,
        reset_time: new Date(result.resetTime).toISOString()
      }
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
      }
    }
  )
}

// Middleware wrapper for Next.js API routes
export function withRateLimit(
  handler: (request: NextRequest) => Promise<Response> | Response,
  limiter: (request: NextRequest) => RateLimitResult = apiRateLimiter
) {
  return async (request: NextRequest): Promise<Response> => {
    const rateLimitResult = limiter(request)
    
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult)
    }
    
    // Add rate limit headers to successful responses
    const response = await handler(request)
    
    // Clone response to add headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers)
    })
    
    newResponse.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
    newResponse.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    newResponse.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString())
    
    return newResponse
  }
}