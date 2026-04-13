'use client'

import { UserButton, SignInButton, useUser } from '@clerk/nextjs'
import { User } from 'lucide-react'

/**
 * User navigation: shows Clerk UserButton when signed in,
 * SignInButton modal when signed out.
 */
export function UserNav() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) return <div className="h-8 w-8" />

  if (isSignedIn) {
    return (
      <UserButton
        appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
        userProfileMode="navigation"
        userProfileUrl="/account/profiel"
      />
    )
  }

  return (
    <SignInButton mode="modal">
      <button
        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted hover:text-foreground hover:bg-background transition-colors"
        aria-label="Inloggen"
      >
        <User className="h-4 w-4" aria-hidden="true" />
      </button>
    </SignInButton>
  )
}
