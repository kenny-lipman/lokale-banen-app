import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  ProseContent,
  PillButton,
  ArrowRight,
} from '@/components/eyeron'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Over ons | ${tenant?.name || 'Lokale Banen'}`,
    description:
      tenant?.seo_description ||
      `Meer informatie over ${tenant?.name || 'ons platform'}`,
    alternates: {
      canonical: tenant?.domain ? `https://${tenant.domain}/over-ons` : undefined,
    },
  }
}

const DEFAULT_ABOUT = `## Onze missie

Wij geloven dat de beste banen dicht bij huis te vinden zijn. Ons platform maakt het eenvoudig om vacatures in jouw regio te ontdekken, zonder ruis en zonder dezelfde vacature in tien tabbladen.

## Wat wij doen

- Dagelijks nieuwe vacatures uit de regio
- Eenvoudig zoeken op functie, locatie en uren
- Direct solliciteren bij de werkgever
- Lokale werkgevers, lokale banen, niet de grote landelijke spelers

## Onderdeel van het LokaleBanen-netwerk

We zijn één van de tientallen regionale jobboards binnen het LokaleBanen-netwerk. Eén missie, tientallen regio's: werk dichtbij huis vinden.`

export default async function OverOnsPage() {
  const tenant = await getTenant()
  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-meta font-light text-muted">Platform niet gevonden.</p>
      </div>
    )
  }

  const cities = await getCitiesWithJobCounts(tenant.id)
  const content = tenant.about_text || DEFAULT_ABOUT

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: tenant.name, href: '/' }, { label: 'Over ons' }]}
        />
        <PageHero title={`Over ${tenant.name}`} />

        <ProseContent>{content}</ProseContent>

        <div className="mt-12 pt-8 border-t border-divider-subtle">
          <PillButton href="/" variant="primary">
            Bekijk onze vacatures
            <ArrowRight />
          </PillButton>
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
