'use client'

import { User } from 'lucide-react'
import Link from 'next/link'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

/**
 * User navigation: shows Clerk UserButton when auth is configured,
 * otherwise a simple "Inloggen" link.
 */
export function UserNav() {
  if (!CLERK_ENABLED) {
    return (
      <Link
        href="/sign-in"
        className="inline-flex items-center gap-2 text-body text-muted-foreground hover:text-foreground transition-colors"
      >
        <User className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Inloggen</span>
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
      className="inline-flex items-center gap-2 text-body text-muted-foreground hover:text-foreground transition-colors"
    >
      <User className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Inloggen</span>
    </Link>
  )
}
