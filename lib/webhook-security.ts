/**
 * Webhook Security System
 * Provides signature verification and request validation for webhooks
 */

import { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { getWebhookConfig } from './api-config'

// Webhook security error types
export class WebhookSecurityError extends Error {
  constructor(message: string, public code: string = 'WEBHOOK_SECURITY_ERROR') {
    super(message)
    this.name = 'WebhookSecurityError'
  }
}

// Webhook types for different services
export type WebhookType = 'apify' | 'n8n' | 'instantly' | 'general'

// Webhook validation result
interface WebhookValidationResult {
  isValid: boolean
  error?: string
  payload?: any
}

/**
 * Generate HMAC signature for webhook verification
 */
function generateSignature(payload: string, secret: string, algorithm: string = 'sha256'): string {
  return createHmac(algorithm, secret)
    .update(payload, 'utf8')
    .digest('hex')
}

/**
 * Safely compare two signatures to prevent timing attacks
 */
function verifySignature(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false
  }

  try {
    const expectedBuffer = Buffer.from(expected, 'hex')
    const providedBuffer = Buffer.from(provided, 'hex')
    return timingSafeEqual(expectedBuffer, providedBuffer)
  } catch (error) {
    return false
  }
}

/**
 * Extract signature from request headers (supports multiple formats)
 */
function extractSignature(req: NextRequest): string | null {
  // Check common signature header formats
  const signatures = [
    req.headers.get('x-signature'),
    req.headers.get('x-hub-signature-256'),
    req.headers.get('x-signature-sha256'),
    req.headers.get('signature')
  ]

  for (const sig of signatures) {
    if (sig) {
      // Remove algorithm prefix if present (e.g., "sha256=...")
      return sig.replace(/^sha256=/, '').replace(/^sha1=/, '')
    }
  }

  return null
}

/**
 * Validate webhook request timestamp to prevent replay attacks
 */
function validateTimestamp(timestamp: string | null, toleranceSeconds: number = 300): boolean {
  if (!timestamp) return false

  try {
    const requestTime = parseInt(timestamp)
    const currentTime = Math.floor(Date.now() / 1000)
    const timeDiff = Math.abs(currentTime - requestTime)

    return timeDiff <= toleranceSeconds
  } catch (error) {
    return false
  }
}

/**
 * Get webhook secret for specific service
 */
function getWebhookSecret(webhookType: WebhookType): string {
  const config = getWebhookConfig()

  switch (webhookType) {
    case 'apify':
      return config.apifySecret
    case 'n8n':
      return config.n8nSecret
    default:
      throw new WebhookSecurityError(`Unknown webhook type: ${webhookType}`)
  }
}

/**
 * Comprehensive webhook validation
 */
export async function validateWebhookRequest(
  req: NextRequest,
  webhookType: WebhookType,
  options: {
    requireSignature?: boolean
    requireTimestamp?: boolean
    timestampTolerance?: number
  } = {}
): Promise<WebhookValidationResult> {
  const {
    requireSignature = true,
    requireTimestamp = false,
    timestampTolerance = 300
  } = options

  try {
    // Get the raw payload
    const payload = await req.text()

    if (!payload) {
      return {
        isValid: false,
        error: 'Empty webhook payload'
      }
    }

    // Validate JSON format
    let parsedPayload
    try {
      parsedPayload = JSON.parse(payload)
    } catch (error) {
      return {
        isValid: false,
        error: 'Invalid JSON payload'
      }
    }

    // Signature verification
    if (requireSignature) {
      const providedSignature = extractSignature(req)

      if (!providedSignature) {
        return {
          isValid: false,
          error: 'Missing webhook signature'
        }
      }

      const secret = getWebhookSecret(webhookType)
      const expectedSignature = generateSignature(payload, secret)

      if (!verifySignature(expectedSignature, providedSignature)) {
        return {
          isValid: false,
          error: 'Invalid webhook signature'
        }
      }
    }

    // Timestamp verification (replay attack prevention)
    if (requireTimestamp) {
      const timestamp = req.headers.get('x-timestamp') || req.headers.get('timestamp')

      if (!validateTimestamp(timestamp, timestampTolerance)) {
        return {
          isValid: false,
          error: 'Invalid or expired timestamp'
        }
      }
    }

    return {
      isValid: true,
      payload: parsedPayload
    }

  } catch (error) {
    console.error('Webhook validation error:', error)
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Webhook validation failed'
    }
  }
}

/**
 * Higher-order function to wrap webhook handlers with security
 */
export function withWebhookSecurity<T extends any[]>(
  webhookType: WebhookType,
  handler: (req: NextRequest, payload: any, ...args: T) => Promise<Response>,
  options?: {
    requireSignature?: boolean
    requireTimestamp?: boolean
    timestampTolerance?: number
  }
) {
  return async (req: NextRequest, ...args: T): Promise<Response> => {
    try {
      const validation = await validateWebhookRequest(req, webhookType, options)

      if (!validation.isValid) {
        console.error(`Webhook security validation failed for ${webhookType}:`, validation.error)

        return new Response(JSON.stringify({
          success: false,
          error: 'Webhook security validation failed',
          code: 'WEBHOOK_SECURITY_ERROR'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Call the original handler with validated payload
      return await handler(req, validation.payload, ...args)

    } catch (error) {
      console.error(`Webhook security error for ${webhookType}:`, error)

      return new Response(JSON.stringify({
        success: false,
        error: 'Webhook security system error',
        code: 'WEBHOOK_SYSTEM_ERROR'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

/**
 * Utility function for development/testing - generates test signatures
 */
export function generateTestSignature(payload: string, webhookType: WebhookType): string {
  const secret = getWebhookSecret(webhookType)
  return generateSignature(payload, secret)
}

/**
 * Rate limiting for webhooks (simple in-memory implementation)
 */
const webhookRateLimits = new Map<string, { count: number; resetTime: number }>()

export function checkWebhookRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMinutes: number = 15
): boolean {
  const now = Date.now()
  const windowMs = windowMinutes * 60 * 1000
  const resetTime = now + windowMs

  const current = webhookRateLimits.get(identifier)

  if (!current || now > current.resetTime) {
    // Reset or initialize
    webhookRateLimits.set(identifier, { count: 1, resetTime })
    return true
  }

  if (current.count >= maxRequests) {
    return false
  }

  current.count++
  return true
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupWebhookRateLimits(): void {
  const now = Date.now()
  for (const [identifier, data] of webhookRateLimits.entries()) {
    if (now > data.resetTime) {
      webhookRateLimits.delete(identifier)
    }
  }
}