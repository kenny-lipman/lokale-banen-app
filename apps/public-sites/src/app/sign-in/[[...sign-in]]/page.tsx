import { getTenant } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default async function SignInPage() {
  const tenant = await getTenant()

  // When Clerk is configured, render the Clerk SignIn component
  if (CLERK_ENABLED) {
    try {
      const { SignIn } = await import('@clerk/nextjs')
      return (
        <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold">
                Welkom bij {tenant?.hero_title || tenant?.name || 'Lokale Banen'}
              </h1>
              <p className="text-base text-muted-foreground mt-2">
                Log in of maak een account aan om vacatures op te slaan en te solliciteren
              </p>
            </div>
            <SignIn
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'shadow-md border rounded-xl',
                },
              }}
              fallbackRedirectUrl="/"
              signUpUrl="/sign-up"
            />
          </div>
        </div>
      )
    } catch {
      // Fall through to placeholder
    }
  }

  // Placeholder when Clerk is not configured
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Inloggen</h1>
        <p className="text-base text-muted-foreground mb-6">
          De inlogfunctie is binnenkort beschikbaar bij{' '}
          {tenant?.hero_title || tenant?.name || 'Lokale Banen'}.
        </p>
        <Button asChild>
          <Link href="/" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Terug naar vacatures
          </Link>
        </Button>
      </div>
    </div>
  )
}
