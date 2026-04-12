import { SignIn } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'

export default async function SignInPage() {
  const tenant = await getTenant()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-h1 font-bold">
            Welkom bij {tenant?.hero_title || tenant?.name || 'Lokale Banen'}
          </h1>
          <p className="text-body text-muted-foreground mt-2">
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
}
