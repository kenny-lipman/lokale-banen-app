/**
 * Clerk user type definitions for use across the monorepo.
 * These mirror the relevant fields from Clerk's User object.
 */

export interface ClerkUser {
  id: string
  firstName: string | null
  lastName: string | null
  emailAddresses: ClerkEmailAddress[]
  primaryEmailAddressId: string | null
  imageUrl: string
  createdAt: Date
  updatedAt: Date
}

export interface ClerkEmailAddress {
  id: string
  emailAddress: string
  verification: {
    status: string
  } | null
}

/**
 * Minimal session claims available in Clerk JWT.
 */
export interface ClerkSessionClaims {
  sub: string
  email: string
  firstName?: string
  lastName?: string
}

/**
 * Token getter function type, matching Clerk's getToken signature.
 */
export type GetTokenFn = (opts: { template: string }) => Promise<string | null>
