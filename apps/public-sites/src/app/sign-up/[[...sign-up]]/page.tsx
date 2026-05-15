import Link from 'next/link'
import { SignUp } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { SiteHeader, SiteFooter, ArrowRight } from '@/components/eyeron'

export const metadata = { title: 'Account aanmaken' }

export default async function SignUpPage() {
  const tenant = await getTenant()
  const cities = tenant ? await getCitiesWithJobCounts(tenant.id) : []

  return (
    <div className="flex flex-col min-h-screen bg-page">
      {tenant && <SiteHeader tenant={tenant} />}

      <main className="flex-1 flex items-start justify-center px-pad pb-12 pt-8 sm:items-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-7">
            <h1 className="m-0 text-h1 font-bold text-primary tracking-tight">
              Account aanmaken
            </h1>
            <p className="m-0 mt-3 text-meta font-light text-muted">
              Gratis account bij{' '}
              {tenant?.hero_title || tenant?.name || 'Lokale Banen'}: opslaan,
              sollicitaties bijhouden, e-mailalerts.
            </p>
          </div>

          <SignUp
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
            signInUrl="/sign-in"
          />

          <p className="text-center mt-5 text-small font-light text-muted leading-relaxed max-w-prose mx-auto">
            Door een account aan te maken ga je akkoord met onze{' '}
            <Link
              href="/voorwaarden"
              className="text-secondary hover:underline underline-offset-2"
            >
              algemene voorwaarden
            </Link>{' '}
            en het{' '}
            <Link
              href="/privacy"
              className="text-secondary hover:underline underline-offset-2"
            >
              privacybeleid
            </Link>
            .
          </p>

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
