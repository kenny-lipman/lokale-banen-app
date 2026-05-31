/**
 * API Route Authentication Utilities
 *
 * Provides flexible authentication for API routes:
 * - Secret-based auth for cron jobs and external systems
 * - Supabase session auth for dashboard/browser requests
 *
 * Usage:
 *
 * // For dashboard routes (accepts both secret and Supabase session):
 * if (!(await validateDashboardRequest(req))) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 *
 * // For cron-only routes (accepts only secret):
 * if (!validateCronRequest(req)) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */

import { NextRequest } from 'next/server';

// Default secrets to check
const CRON_SECRET = process.env.CRON_SECRET_KEY;
const BACKFILL_SECRET = process.env.INSTANTLY_BACKFILL_SECRET;

interface AuthOptions {
  /** Additional secret to accept (besides CRON_SECRET_KEY) */
  additionalSecret?: string;
  /** Custom header name to check for secret */
  secretHeader?: string;
  /** Query parameter name to check for secret */
  secretParam?: string;
  /** Allow if no secrets are configured (dev mode) */
  allowNoSecret?: boolean;
}

/**
 * Validates secret-based authentication.
 * Use this for cron jobs and external API calls.
 */
export function validateSecretAuth(
  req: NextRequest,
  options: AuthOptions = {}
): boolean {
  const {
    additionalSecret,
    secretHeader = 'x-api-secret',
    secretParam = 'secret',
    allowNoSecret = false,
  } = options;

  // Collect all valid secrets
  const validSecrets = [CRON_SECRET, BACKFILL_SECRET, additionalSecret].filter(Boolean) as string[];

  // If no secrets configured, check allowNoSecret
  if (validSecrets.length === 0) {
    if (allowNoSecret) {
      console.warn('No secrets configured, allowing request');
      return true;
    }
    return false;
  }

  // Check Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (validSecrets.includes(token)) {
      return true;
    }
  }

  // Check custom header
  const headerValue = req.headers.get(secretHeader);
  if (headerValue && validSecrets.includes(headerValue)) {
    return true;
  }

  // Check query parameter
  const url = new URL(req.url);
  const paramValue = url.searchParams.get(secretParam);
  if (paramValue && validSecrets.includes(paramValue)) {
    return true;
  }

  return false;
}

/**
 * Validates requests for cron jobs.
 * Only accepts secret-based authentication.
 */
export function validateCronRequest(
  req: NextRequest,
  options: AuthOptions = {}
): boolean {
  // Allow development mode
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return validateSecretAuth(req, { ...options, allowNoSecret: false });
}
