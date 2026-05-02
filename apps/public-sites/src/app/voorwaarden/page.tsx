import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  ProseContent,
} from '@/components/eyeron'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Algemene Voorwaarden | ${tenant?.name || 'Lokale Banen'}`,
    description: `Algemene voorwaarden van ${tenant?.name || 'ons platform'}`,
    alternates: {
      canonical: tenant?.domain ? `https://${tenant.domain}/voorwaarden` : undefined,
    },
  }
}

export default async function VoorwaardenPage() {
  const tenant = await getTenant()
  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-meta font-light text-body">Platform niet gevonden.</p>
      </div>
    )
  }

  const cities = await getCitiesWithJobCounts(tenant.id)
  const hasContent = !!tenant.terms_text

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: tenant.name, href: '/' }, { label: 'Algemene Voorwaarden' }]}
        />
        <PageHero title="Algemene Voorwaarden" />

        {hasContent ? (
          <ProseContent>{tenant.terms_text!}</ProseContent>
        ) : (
          <p className="text-meta font-light text-body max-w-prose">
            De algemene voorwaarden worden binnenkort gepubliceerd.
          </p>
        )}
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
