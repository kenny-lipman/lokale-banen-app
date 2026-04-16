import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Footer } from '@/components/footer'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Bedrijven${tenant?.central_place ? ` in ${tenant.central_place}` : ''}`,
    description: tenant
      ? `Bekijk lokale werkgevers bij ${tenant.name}.`
      : 'Bekijk lokale werkgevers in jouw regio.',
  }
}

export default async function BedrijvenPage() {
  const tenant = await getTenant()
  if (!tenant) return null

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader tenant={tenant} showSearch={false} />

      <main className="flex-1 flex items-center justify-center" style={{ padding: 'var(--pad)' }}>
        <div className="text-center" style={{ maxWidth: 480 }}>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
              fontWeight: 500,
              letterSpacing: '-0.015em',
              color: 'var(--text)',
              marginBottom: 12,
            }}
          >
            Bedrijven in {tenant.central_place || 'de regio'}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
            Binnenkort kun je hier lokale werkgevers ontdekken en hun
            openstaande vacatures bekijken. Wil je nu al zoeken?
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full mt-6"
            style={{
              padding: '11px 22px',
              background: 'var(--primary)',
              color: 'var(--primary-ink)',
              fontWeight: 600,
              fontSize: '0.9375rem',
            }}
          >
            Bekijk vacatures
          </a>
        </div>
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
