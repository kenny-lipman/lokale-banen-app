'use client'

import { User } from 'lucide-react'
import Link from 'next/link'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

/**
 * User navigation: shows Clerk UserButton when auth is configured,
 * otherwise a simple user icon link. 32px on mobile.
 */
export function UserNav() {
  if (!CLERK_ENABLED) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted hover:text-foreground hover:bg-background transition-colors"
        aria-label="Inloggen"
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </Link>
    )
  }

  return <ClerkUserNav />
}

/**
 * Lazy-loaded Clerk user nav component.
 * Only renders when CLERK_ENABLED is true.
 */
function ClerkUserNav() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUser, UserButton } = require('@clerk/nextjs')
    const { isSignedIn, isLoaded } = useUser()

    if (!isLoaded) return null

    if (isSignedIn) {
      return (
        <UserButton
          appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
          userProfileMode="navigation"
          userProfileUrl="/account/profiel"
        />
      )
    }
  } catch {
    // Clerk not available
  }

  return (
    <Link
      href="/sign-in"
      className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted hover:text-foreground hover:bg-background transition-colors"
      aria-label="Inloggen"
    >
      <User className="h-4 w-4" aria-hidden="true" />
    </Link>
  )
}
