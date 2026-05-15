import Link from 'next/link'
import { SignIn } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { SiteHeader, SiteFooter, ArrowRight } from '@/components/eyeron'

export const metadata = { title: 'Inloggen' }

export default async function SignInPage() {
  const tenant = await getTenant()
  const cities = tenant ? await getCitiesWithJobCounts(tenant.id) : []

  return (
    <div className="flex flex-col min-h-screen bg-page">
      {tenant && <SiteHeader tenant={tenant} />}

      <main className="flex-1 flex items-start justify-center px-pad pb-12 pt-8 sm:items-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-7">
            <h1 className="m-0 text-h1 font-bold text-primary tracking-tight">
              Welkom bij {tenant?.hero_title || tenant?.name || 'Lokale Banen'}
            </h1>
            <p className="m-0 mt-3 text-meta font-light text-muted">
              Log in of maak een account aan om vacatures op te slaan en te
              solliciteren.
            </p>
          </div>

          <SignIn
            appearance={{
              variables: {
                colorPrimary: tenant?.primary_color || '#0A6333',
                colorText: tenant?.primary_color || '#0A6333',
                colorInputBackground: '#FFFFFF',
                colorInputText: '#0A6333',
                fontFamily: 'Tomica, Inter, system-ui, sans-serif',
                borderRadius: '20px',
              },
              elements: {
                rootBox: 'w-full',
                card: 'shadow-card border border-divider-subtle rounded-none bg-surface',
                headerTitle: 'text-primary',
                headerSubtitle: 'text-muted',
                socialButtonsBlockButton: 'border-divider hover:bg-primary-tint',
                formButtonPrimary:
                  'bg-primary text-primary-ink hover:bg-primary-hover normal-case tracking-tight font-bold',
                footerActionLink: 'text-secondary hover:text-secondary-hover',
              },
            }}
            fallbackRedirectUrl="/"
            signUpUrl="/sign-up"
          />

          <p className="text-center mt-6 text-meta font-light text-muted">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-secondary hover:underline underline-offset-2"
            >
              <ArrowRight className="rotate-180" width={11} height={8} />
              Terug naar de vacatures
            </Link>
          </p>
        </div>
      </main>

      {tenant && <SiteFooter tenant={tenant} cities={cities} />}
    </div>
  )
}
