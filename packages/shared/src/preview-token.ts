/**
 * HMAC-based preview tokens for admin draft preview.
 *
 * Generates signed URLs that allow the admin to preview pending/unpublished
 * vacatures on the public site without requiring a login on the public site.
 *
 * Security: tokens expire after 1 hour. Secret must be shared between
 * admin and public-sites apps via VACATURE_PREVIEW_SECRET env var.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

function getSecret(): string {
  const secret = process.env.VACATURE_PREVIEW_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'VACATURE_PREVIEW_SECRET env var is missing or too short (min 32 chars)'
    )
  }
  return secret
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Generate a signed preview token for a specific job posting.
 * Token format: `${expiryMs}.${hmac}`
 */
export function generatePreviewToken(jobId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS
  const payload = `${jobId}:${expiry}`
  const signature = sign(payload, getSecret())
  return `${expiry}.${signature}`
}

/**
 * Verify a preview token for a given job posting.
 * Returns true if valid and not expired.
 */
export function verifyPreviewToken(jobId: string, token: string): boolean {
  try {
    const [expiryStr, signature] = token.split('.')
    if (!expiryStr || !signature) return false

    const expiry = Number(expiryStr)
    if (!Number.isFinite(expiry) || Date.now() > expiry) return false

    const payload = `${jobId}:${expiry}`
    const expected = sign(payload, getSecret())

    if (signature.length !== expected.length) return false

    // Timing-safe comparison to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}
