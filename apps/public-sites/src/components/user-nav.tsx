'use client'

import { Button } from '@/components/ui/button'
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
      <Button variant="ghost" size="sm" asChild>
        <Link href="/sign-in" className="flex items-center gap-2">
          <User className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Inloggen</span>
        </Link>
      </Button>
    )
  }

  // When Clerk is available, use a dynamic wrapper
  return <ClerkUserNav />
}

/**
 * Lazy-loaded Clerk user nav component.
 * Only renders when CLERK_ENABLED is true.
 */
function ClerkUserNav() {
  // Dynamic import approach: use a simple fallback since
  // we can't use top-level await in client components
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUser, UserButton } = require('@clerk/nextjs')
    const { isSignedIn, isLoaded } = useUser()

    if (!isLoaded) return null

    if (isSignedIn) {
      return (
        <UserButton
          appearance={{ elements: { avatarBox: 'h-9 w-9' } }}
          userProfileMode="navigation"
          userProfileUrl="/account/profiel"
        />
      )
    }
  } catch {
    // Clerk not available
  }

  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/sign-in" className="flex items-center gap-2">
        <User className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Inloggen</span>
      </Link>
    </Button>
  )
}
