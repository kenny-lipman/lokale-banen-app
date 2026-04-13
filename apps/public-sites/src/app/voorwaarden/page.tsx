import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Footer } from '@/components/footer'
import { renderMarkdown } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Algemene Voorwaarden | ${tenant?.name || 'Lokale Banen'}`,
    description: `Algemene voorwaarden van ${tenant?.name || 'ons platform'}`,
  }
}

export default async function VoorwaardenPage() {
  const tenant = await getTenant()

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-body text-muted-foreground">Platform niet gevonden.</p>
      </div>
    )
  }

  const hasContent = !!tenant.terms_text
  const html = hasContent ? renderMarkdown(tenant.terms_text!) : null

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      <main className="flex-1 max-w-content mx-auto w-full py-8 px-4 lg:px-8">
        <div className="mb-8">
          <h1 className="text-display text-foreground">Algemene Voorwaarden</h1>
        </div>

        {hasContent ? (
          <div
            className="text-body text-foreground"
            dangerouslySetInnerHTML={{ __html: html! }}
          />
        ) : (
          <p className="text-body text-muted">
            De algemene voorwaarden worden binnenkort gepubliceerd.
          </p>
        )}
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
