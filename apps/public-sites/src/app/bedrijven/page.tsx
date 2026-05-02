import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  EmptyState,
  PillButton,
  ArrowRight,
} from '@/components/eyeron'

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

  const cities = await getCitiesWithJobCounts(tenant.id)
  const place = tenant.central_place || 'de regio'

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[
            { label: tenant.name, href: '/' },
            { label: 'Bedrijven' },
          ]}
        />
        <PageHero
          title={`Bedrijven in ${place}`}
          description={`Ontdek lokale werkgevers bij ${tenant.name} en bekijk hun openstaande vacatures.`}
        />

        <EmptyState
          title="Binnenkort beschikbaar"
          body="We werken aan een complete bedrijven-overzichtspagina waar je werkgevers per branche, locatie en grootte kunt filteren. In de tussentijd kun je vacatures rechtstreeks doorzoeken."
          action={
            <PillButton href="/" variant="primary">
              Naar de vacatures
              <ArrowRight />
            </PillButton>
          }
        />
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
