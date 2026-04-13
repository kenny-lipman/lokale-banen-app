import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Footer } from '@/components/footer'
import { renderMarkdown } from '@/lib/utils'
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Over ons | ${tenant?.name || 'Lokale Banen'}`,
    description: tenant?.seo_description || `Meer informatie over ${tenant?.name || 'ons platform'}`,
    alternates: {
      canonical: tenant?.domain ? `https://${tenant.domain}/over-ons` : undefined,
    },
  }
}

const DEFAULT_ABOUT = `## Over ons

Welkom bij ons vacatureplatform. Wij verbinden werkzoekenden met lokale werkgevers in de regio.

### Onze missie

Wij geloven dat de beste banen dicht bij huis te vinden zijn. Ons platform maakt het eenvoudig om vacatures in jouw regio te ontdekken.

### Wat wij doen

- Dagelijks nieuwe vacatures uit de regio
- Eenvoudig zoeken op functie en locatie
- Direct solliciteren bij de werkgever`

export default async function OverOnsPage() {
  const tenant = await getTenant()

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-body text-muted-foreground">Platform niet gevonden.</p>
      </div>
    )
  }

  const content = tenant.about_text || DEFAULT_ABOUT
  const html = renderMarkdown(content)

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      <main className="flex-1 max-w-content mx-auto w-full py-8 px-4 lg:px-8">
        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-display text-foreground">Over {tenant.name}</h1>
        </div>

        {/* Content */}
        <div
          className="text-body text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* CTA */}
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
          <Link
            href="/"
            className="inline-flex items-center justify-center h-10 px-6 rounded-lg text-button text-primary-foreground transition-colors"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Bekijk onze vacatures
          </Link>
        </div>
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
