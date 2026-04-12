import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { User, Heart, Briefcase } from 'lucide-react'
import Link from 'next/link'

/**
 * User navigation component in the header.
 * Shows Clerk UserButton when signed in, login link when signed out.
 */
export function UserNav() {
  return (
    <div className="flex items-center">
      <SignedIn>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'h-9 w-9',
            },
          }}
          userProfileMode="navigation"
          userProfileUrl="/account/profiel"
        >
          <UserButton.MenuItems>
            <UserButton.Link
              label="Opgeslagen vacatures"
              labelIcon={<Heart className="h-4 w-4" />}
              href="/account/opgeslagen"
            />
            <UserButton.Link
              label="Mijn sollicitaties"
              labelIcon={<Briefcase className="h-4 w-4" />}
              href="/account/sollicitaties"
            />
          </UserButton.MenuItems>
        </UserButton>
      </SignedIn>
      <SignedOut>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sign-in" className="flex items-center gap-2">
            <User className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Inloggen</span>
          </Link>
        </Button>
      </SignedOut>
    </div>
  )
}
