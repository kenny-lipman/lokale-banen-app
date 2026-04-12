import { SignUp } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'

export default async function SignUpPage() {
  const tenant = await getTenant()

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-h1 font-bold">
            Account aanmaken
          </h1>
          <p className="text-body text-muted-foreground mt-2">
            Maak een gratis account aan bij {tenant?.hero_title || tenant?.name || 'Lokale Banen'}
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-md border rounded-xl',
            },
          }}
          fallbackRedirectUrl="/"
          signInUrl="/sign-in"
        />
      </div>
    </div>
  )
}
