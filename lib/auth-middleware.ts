/**
 * Modular Authentication Middleware System
 * Provides scalable authentication and authorization controls
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedClient } from './supabase-server'
import { User } from '@supabase/supabase-js'

// Error types for consistent error handling
export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'UNAUTHORIZED') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public code: string = 'FORBIDDEN') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

// User profile interface
interface UserProfile {
  id: string
  email: string
  role: string
  full_name?: string
}

// Authentication result interface
export interface AuthResult {
  user: User
  profile: UserProfile
  supabase: any
}

/**
 * Core authentication function - verifies user is logged in
 */
export async function requireAuthentication(req: NextRequest): Promise<AuthResult> {
  try {
    const { user, supabase } = await getAuthenticatedClient(req)

    // Create a simplified profile from user data
    const profile: UserProfile = {
      id: user.id,
      email: user.email || '',
      role: 'member', // Default role for now
      full_name: user.user_metadata?.full_name || user.email || ''
    }

    return { user, profile, supabase }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw new AuthenticationError('Authentication required - please log in')
  }
}

/**
 * Role-based authorization - checks if user has required role
 */
export async function requireRole(req: NextRequest, requiredRole: string): Promise<AuthResult> {
  const authResult = await requireAuthentication(req)

  // Define role hierarchy (higher numbers = more permissions)
  const roleHierarchy: Record<string, number> = {
    'member': 1,
    'admin': 10,
    'super_admin': 100
  }

  const userRoleLevel = roleHierarchy[authResult.profile.role] || 0
  const requiredRoleLevel = roleHierarchy[requiredRole] || 999

  if (userRoleLevel < requiredRoleLevel) {
    throw new AuthorizationError(
      `Access denied. Required role: ${requiredRole}, user role: ${authResult.profile.role}`,
      'INSUFFICIENT_PERMISSIONS'
    )
  }

  return authResult
}

/**
 * Admin authentication shortcut
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  return await requireRole(req, 'admin')
}

/**
 * API key validation for system endpoints
 */
export function validateApiKey(req: NextRequest, expectedKey: string): boolean {
  const providedKey = req.headers.get('x-api-key') ||
                     req.nextUrl.searchParams.get('api_key') ||
                     req.nextUrl.searchParams.get('secret')

  return providedKey === expectedKey
}

/**
 * CRON job authentication using secret key
 */
export function requireCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET_KEY
  if (!cronSecret) {
    throw new AuthenticationError('CRON secret key not configured')
  }

  return validateApiKey(req, cronSecret)
}

/**
 * Utility function to create standardized error responses
 */
export function createAuthErrorResponse(error: AuthenticationError | AuthorizationError): NextResponse {
  const status = error instanceof AuthorizationError ? 403 : 401

  return NextResponse.json({
    success: false,
    error: error.message,
    code: error.code,
    timestamp: new Date().toISOString()
  }, { status })
}

/**
 * Higher-order function to wrap API route handlers with authentication
 */
export function withAuth<T extends any[]>(
  handler: (req: NextRequest, authResult: AuthResult, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const authResult = await requireAuthentication(req)
      return await handler(req, authResult, ...args)
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return createAuthErrorResponse(error)
      }

      console.error('Unexpected authentication error:', error)
      return NextResponse.json({
        success: false,
        error: 'Internal authentication error',
        code: 'AUTH_SYSTEM_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Higher-order function to wrap API route handlers with admin authentication
 */
export function withAdminAuth<T extends any[]>(
  handler: (req: NextRequest, authResult: AuthResult, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const authResult = await requireAdmin(req)
      return await handler(req, authResult, ...args)
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return createAuthErrorResponse(error)
      }

      console.error('Unexpected admin authentication error:', error)
      return NextResponse.json({
        success: false,
        error: 'Internal authentication error',
        code: 'AUTH_SYSTEM_ERROR'
      }, { status: 500 })
    }
  }
}

/**
 * Higher-order function for CRON endpoints
 */
export function withCronAuth<T extends any[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const isAuthorized = requireCronAuth(req)

      if (!isAuthorized) {
        throw new AuthenticationError('Invalid CRON authentication key', 'INVALID_CRON_KEY')
      }

      return await handler(req, ...args)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return createAuthErrorResponse(error)
      }

      console.error('Unexpected CRON authentication error:', error)
      return NextResponse.json({
        success: false,
        error: 'CRON authentication failed',
        code: 'CRON_AUTH_ERROR'
      }, { status: 500 })
    }
  }
}