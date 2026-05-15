import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { renderLegalTemplate } from '@/lib/legal/render'
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
    title: `Privacybeleid | ${tenant?.name || 'Lokale Banen'}`,
    description: `Privacybeleid van ${tenant?.name || 'ons platform'}`,
    alternates: {
      canonical: tenant?.domain ? `https://${tenant.domain}/privacy` : undefined,
    },
  }
}

export default async function PrivacyPage() {
  const tenant = await getTenant()
  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-meta font-light text-muted">Platform niet gevonden.</p>
      </div>
    )
  }

  const [cities, content] = await Promise.all([
    getCitiesWithJobCounts(tenant.id),
    tenant.privacy_text
      ? Promise.resolve(tenant.privacy_text)
      : renderLegalTemplate('privacy', tenant.name),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: tenant.name, href: '/' }, { label: 'Privacybeleid' }]}
        />
        <PageHero title="Privacybeleid" />

        <ProseContent>{content}</ProseContent>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
