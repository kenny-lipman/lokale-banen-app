import { NextRequest } from "next/server"
import { cacheService } from "@/lib/cache-service"

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: NextRequest) => string
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: this.defaultKeyGenerator,
      ...config
    }
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(req: NextRequest): Promise<RateLimitResult> {
    const key = this.config.keyGenerator!(req)
    const now = Date.now()
    const windowStart = now - this.config.windowMs
    
    // Get current request count for this window
    const requestKey = `rate_limit:${key}:${Math.floor(now / this.config.windowMs)}`
    const currentCount = cacheService.get<number>(requestKey) || 0
    
    if (currentCount >= this.config.maxRequests) {
      const resetTime = Math.ceil(now / this.config.windowMs) * this.config.windowMs
      const retryAfter = Math.ceil((resetTime - now) / 1000)
      
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime,
        retryAfter
      }
    }

    // Increment counter
    const newCount = cacheService.increment(requestKey, this.config.windowMs)
    
    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - newCount),
      resetTime: Math.ceil(now / this.config.windowMs) * this.config.windowMs
    }
  }

  /**
   * Record a request (for conditional counting)
   */
  async recordRequest(req: NextRequest, success: boolean): Promise<void> {
    if (
      (success && this.config.skipSuccessfulRequests) ||
      (!success && this.config.skipFailedRequests)
    ) {
      return
    }

    // Implementation would record the request
    // For now, the counting happens in checkLimit
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(req: NextRequest): string {
    return req.ip || 
           req.headers.get('x-forwarded-for')?.split(',')[0] || 
           req.headers.get('x-real-ip') || 
           'unknown'
  }
}

// Predefined rate limiters for different endpoints
export const statusApiLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10, // 10 requests per minute
  keyGenerator: (req) => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
    return `status_api:${ip}`
  }
})

export const enrichmentApiLimiter = new RateLimiter({
  windowMs: 300000, // 5 minutes
  maxRequests: 5, // 5 enrichment requests per 5 minutes
  keyGenerator: (req) => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
    return `enrichment_api:${ip}`
  }
})

export const generalApiLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  keyGenerator: (req) => {
    const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
    return `general_api:${ip}`
  }
})

/**
 * Rate limiting utility functions
 */
export class RateLimitUtils {
  /**
   * Get rate limit headers for response
   */
  static getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
    }

    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString()
    }

    return headers
  }

  /**
   * Create a sliding window rate limiter
   */
  static createSlidingWindow(
    windowMs: number, 
    maxRequests: number, 
    keyPrefix: string = 'sliding'
  ): RateLimiter {
    return new RateLimiter({
      windowMs,
      maxRequests,
      keyGenerator: (req) => {
        const ip = req.ip || req.headers.get('x-forwarded-for') || 'unknown'
        return `${keyPrefix}:${ip}`
      }
    })
  }

  /**
   * Get rate limit statistics
   */
  static async getRateLimitStats(): Promise<{
    activeWindows: number
    totalRequests: number
    blockedRequests: number
  }> {
    const cacheStats = cacheService.getStats()
    const rateLimitEntries = cacheService.getEntries()
      .filter(entry => entry.key.startsWith('rate_limit:'))
    
    const totalRequests = rateLimitEntries
      .reduce((sum, entry) => sum + entry.entry.data, 0)
    
    return {
      activeWindows: rateLimitEntries.length,
      totalRequests,
      blockedRequests: 0 // Would need additional tracking
    }
  }
}