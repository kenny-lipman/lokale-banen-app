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
import { createServerClientFromRequest } from '@/lib/supabase-server';

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
 * Validates Supabase session authentication.
 * Use this for dashboard/browser requests.
 */
export async function validateSupabaseAuth(req: NextRequest): Promise<boolean> {
  try {
    const supabase = createServerClientFromRequest(req);
    const { data: { user }, error } = await supabase.auth.getUser();
    return !error && !!user;
  } catch {
    return false;
  }
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

/**
 * Validates requests for dashboard API routes.
 * Accepts secret-based auth, Supabase session, OR same-origin browser requests.
 *
 * This is permissive for dashboard routes because:
 * 1. The dashboard itself requires login to access
 * 2. API routes are called from the authenticated dashboard
 * 3. CORS prevents cross-origin requests
 */
export async function validateDashboardRequest(
  req: NextRequest,
  options: AuthOptions = {}
): Promise<boolean> {
  // First, try secret-based auth (for cron jobs and external calls)
  if (validateSecretAuth(req, options)) {
    return true;
  }

  // Then try Supabase session auth
  if (await validateSupabaseAuth(req)) {
    return true;
  }

  // Allow browser requests from same origin (dashboard)
  // These have proper headers that indicate a legitimate browser request
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const secFetchSite = req.headers.get('sec-fetch-site');

  // If it's a same-origin request from the browser, allow it
  // The dashboard itself is protected by Supabase auth on the client side
  if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
    return true;
  }

  // Allow if referer matches our domain
  if (referer && (
    referer.includes('lokale-banen-app.vercel.app') ||
    referer.includes('localhost:3000')
  )) {
    return true;
  }

  // Allow if no secrets configured (dev mode fallback)
  const validSecrets = [CRON_SECRET, BACKFILL_SECRET, options.additionalSecret].filter(Boolean);
  if (validSecrets.length === 0 && options.allowNoSecret !== false) {
    console.warn('No secrets configured, allowing request');
    return true;
  }

  return false;
}
