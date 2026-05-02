import type { Metadata } from 'next'
import { Mail, MapPin, Users, TrendingUp } from 'lucide-react'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts, getJobCount } from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  PillButton,
  ArrowRight,
} from '@/components/eyeron'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: 'Voor werkgevers',
    description: tenant
      ? `Plaats vacatures en bereik werkzoekenden in ${
          tenant.central_place || 'de regio'
        } via ${tenant.name}.`
      : 'Plaats vacatures en bereik werkzoekenden in jouw regio.',
    alternates: {
      canonical: tenant?.domain ? `https://${tenant.domain}/werkgevers` : undefined,
    },
  }
}

export default async function WerkgeversPage() {
  const tenant = await getTenant()
  if (!tenant) return null

  const [cities, totalJobs] = await Promise.all([
    getCitiesWithJobCounts(tenant.id),
    getJobCount(tenant.id, {}),
  ])

  const place = tenant.central_place || 'de regio'

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: tenant.name, href: '/' }, { label: 'Werkgevers' }]}
        />
        <PageHero
          eyebrow="Voor werkgevers"
          title={`Bereik kandidaten in ${place}`}
          accent={place}
          description={`Plaats jouw vacatures op ${tenant.name} en bereik gericht werkzoekenden in jouw regio. Geen massapublicatie, geen ruis — alleen lokale matches.`}
        />

        {/* Trust-signals */}
        <div className="grid sm:grid-cols-3 gap-3 max-w-3xl my-10">
          <Stat
            icon={TrendingUp}
            value={totalJobs.toLocaleString('nl-NL')}
            label="Open vacatures"
          />
          <Stat icon={MapPin} value={place} label="Regio-focus" />
          <Stat icon={Users} value="Lokaal" label="Doelgroep-bereik" />
        </div>

        {/* Approach */}
        <section className="mt-10 max-w-prose">
          <h2 className="text-h2 font-bold text-primary tracking-tight m-0 mb-4">
            Hoe het werkt
          </h2>
          <ol className="list-none p-0 m-0 grid gap-5">
            <Step
              n={1}
              title="Vacature aanmelden"
              body="Stuur ons jouw vacature met een korte omschrijving, salaris en sollicitatie-link. Geen formulier-frictie."
            />
            <Step
              n={2}
              title="Wij plaatsen + verspreiden"
              body="Binnen 24 uur staat de vacature live op ons platform én op het LokaleBanen-netwerk."
            />
            <Step
              n={3}
              title="Direct contact met kandidaten"
              body="Werkzoekenden klikken direct door naar jouw eigen sollicitatieproces — wij zitten er niet tussen."
            />
          </ol>
        </section>

        {/* CTA */}
        <div className="mt-12 pt-8 border-t border-divider-subtle flex flex-wrap gap-3">
          {tenant.contact_email ? (
            <a
              href={`mailto:${tenant.contact_email}?subject=Vacature plaatsen op ${tenant.name}`}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-button bg-primary text-primary-ink text-meta font-bold tracking-tight transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-2"
            >
              <Mail className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Plaats jouw vacature
            </a>
          ) : (
            <PillButton href="/contact" variant="primary">
              Neem contact op
              <ArrowRight />
            </PillButton>
          )}
          <PillButton href="/">Bekijk de vacatures</PillButton>
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  value: string
  label: string
}) {
  return (
    <div className="bg-surface border border-divider-subtle p-5">
      <Icon className="h-5 w-5 text-secondary" strokeWidth={1.75} aria-hidden="true" />
      <p className="m-0 mt-3 text-h2 font-bold text-primary tracking-tight">{value}</p>
      <p className="m-0 mt-1 text-meta font-light text-body">{label}</p>
    </div>
  )
}

function Step({
  n,
  title,
  body,
}: {
  n: number
  title: string
  body: string
}) {
  return (
    <li className="grid grid-cols-[44px_1fr] gap-4">
      <span className="inline-flex items-center justify-center w-11 h-11 bg-primary text-primary-ink text-h3 font-bold tracking-tight">
        {n}
      </span>
      <div>
        <h3 className="m-0 text-h3 font-bold text-primary tracking-tight">{title}</h3>
        <p className="m-0 mt-1 text-meta font-light text-body leading-relaxed">{body}</p>
      </div>
    </li>
  )
}
