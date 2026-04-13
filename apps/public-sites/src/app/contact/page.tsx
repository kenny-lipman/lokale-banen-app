import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Footer } from '@/components/footer'
import { Mail, Phone } from 'lucide-react'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Contact | ${tenant?.name || 'Lokale Banen'}`,
    description: `Neem contact op met ${tenant?.name || 'ons'}`,
  }
}

export default async function ContactPage() {
  const tenant = await getTenant()

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-body text-muted-foreground">Platform niet gevonden.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      <main className="flex-1 max-w-content mx-auto w-full py-8 px-4 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-display text-foreground">
            Neem contact op met {tenant.name}
          </h1>
        </div>

        {/* Contact info */}
        <div className="space-y-6">
          {tenant.contact_email && (
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0"
                style={{ backgroundColor: 'var(--primary-light)' }}
              >
                <Mail className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-body-medium text-foreground mb-1">E-mail</p>
                <a
                  href={`mailto:${tenant.contact_email}`}
                  className="text-body transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  {tenant.contact_email}
                </a>
              </div>
            </div>
          )}

          {tenant.contact_phone && (
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0"
                style={{ backgroundColor: 'var(--primary-light)' }}
              >
                <Phone className="h-5 w-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="text-body-medium text-foreground mb-1">Telefoon</p>
                <a
                  href={`tel:${tenant.contact_phone}`}
                  className="text-body transition-colors"
                  style={{ color: 'var(--primary)' }}
                >
                  {tenant.contact_phone}
                </a>
              </div>
            </div>
          )}

          {!tenant.contact_email && !tenant.contact_phone && (
            <p className="text-body text-muted">
              Er zijn nog geen contactgegevens beschikbaar voor dit platform.
            </p>
          )}
        </div>

        {/* Info text */}
        <div
          className="mt-8 p-4 rounded-lg text-body"
          style={{ backgroundColor: 'var(--background)' }}
        >
          <p className="text-muted">
            Voor vragen over vacatures verwijzen wij u naar de werkgever. U vindt de
            contactgegevens op de vacaturepagina.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-6 rounded-lg text-button text-primary-foreground transition-colors"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Bekijk vacatures
          </Link>
        </div>
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
