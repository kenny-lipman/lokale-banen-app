'use client'

import { UserButton, SignInButton, useUser } from '@clerk/nextjs'
import { User } from 'lucide-react'

/**
 * Eyeron-getypeerde Clerk-trigger voor het account-menu.
 * Signed in → UserButton (avatar), signed out → User-icon die SignIn opent.
 */
export function UserNav() {
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded) {
    // Reserveer ruimte zodat de header-layout niet shift bij hydratatie.
    return <div className="size-11" aria-hidden="true" />
  }

  if (isSignedIn) {
    return (
      <UserButton
        appearance={{ elements: { avatarBox: 'h-9 w-9' } }}
        userProfileMode="navigation"
        userProfileUrl="/account/profiel"
      />
    )
  }

  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-md text-primary hover:bg-primary-tint transition-colors"
        aria-label="Inloggen"
      >
        <User className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>
    </SignInButton>
  )
}
