'use client'

import { useUser, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { User } from 'lucide-react'
import Link from 'next/link'

export function UserNav() {
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

  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/sign-in" className="flex items-center gap-2">
        <User className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Inloggen</span>
      </Link>
    </Button>
  )
}
