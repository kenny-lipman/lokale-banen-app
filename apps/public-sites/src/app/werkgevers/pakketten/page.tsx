import type { Metadata } from 'next'
import { Check, Instagram, Facebook, Linkedin, Mail } from 'lucide-react'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { COMPANY_INFO } from '@/lib/company-info'
import { SiteHeader, SiteFooter, Breadcrumbs } from '@/components/eyeron'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `${tenant?.name || 'Lokale Banen'} Pakketten`,
    description: tenant
      ? `Pakketten en tarieven voor het plaatsen van vacatures op ${tenant.name}.`
      : 'Pakketten voor het plaatsen van vacatures.',
    alternates: {
      canonical: tenant?.domain
        ? `https://${tenant.domain}/werkgevers/pakketten`
        : undefined,
    },
  }
}

const USP_ITEMS: { left: string[]; right: string[] } = {
  left: [
    'Grootste bereik van de regio',
    'Maatwerk oplossingen voor het vinden van de juiste kandidaat',
    'Sollicitaties direct in je mailbox',
    'Geen tussenkomst van derden',
  ],
  right: [
    'Lokale doelgroep, regionale focus',
    'Aanwezig op Facebook, Instagram & LinkedIn',
    'Snelle plaatsing: binnen 24 uur live',
    'Onderdeel van het LokaleBanen-netwerk',
  ],
}

export default async function PakkettenPage() {
  const tenant = await getTenant()
  if (!tenant) return null

  const cities = await getCitiesWithJobCounts(tenant.id)
  const mailSubjectBase = encodeURIComponent(`[${tenant.name}] Vacature plaatsen`)
  const mailto = `mailto:${COMPANY_INFO.centralEmail}?subject=${mailSubjectBase}`

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1">
        {/* Hero - brand-color band */}
        <div className="bg-primary text-primary-ink">
          <div className="max-w-content mx-auto px-pad py-12 sm:py-16">
            <Breadcrumbs
              className="mb-5 text-on-dark"
              items={[
                { label: tenant.name, href: '/' },
                { label: 'Werkgevers', href: '/werkgevers' },
                { label: 'Pakketten' },
              ]}
            />
            <h1 className="m-0 text-h1 font-bold tracking-tight text-balance">
              {tenant.name} Pakketten
            </h1>
          </div>
        </div>

        <div className="max-w-content mx-auto w-full px-pad py-12 sm:py-16">
          {/* USP-sectie */}
          <section className="max-w-3xl mx-auto text-center">
            <h2 className="m-0 text-h1 font-bold text-primary tracking-tight">
              Waarom jouw vacature op {tenant.name}
            </h2>
            <p className="m-0 mt-2 text-body font-light text-body">
              We zetten het even op een rijtje:
            </p>

            <div className="mt-9 grid sm:grid-cols-2 gap-x-10 gap-y-5 text-left">
              <ul className="space-y-4 m-0 p-0 list-none">
                {USP_ITEMS.left.map((item) => (
                  <UspItem key={item}>{item}</UspItem>
                ))}
              </ul>
              <ul className="space-y-4 m-0 p-0 list-none">
                {USP_ITEMS.right.map((item) => (
                  <UspItem key={item}>{item}</UspItem>
                ))}
              </ul>
            </div>

            <div className="mt-10">
              <a
                href={mailto}
                className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-button bg-secondary text-secondary-ink text-meta font-bold tracking-tight transition-colors hover:bg-secondary-hover"
              >
                <Mail className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Plaats een vacature!
              </a>
            </div>
          </section>

          {/* Prijzen */}
          <section className="mt-20">
            <h2 className="m-0 text-h1 font-bold text-primary tracking-tight text-center">
              Overtuigd? Dit zijn onze prijzen
            </h2>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch">
              {/* Card 1 - Gratis */}
              <PriceCard
                title="Online vacatureplaatsing"
                price="Gratis"
                features={[
                  '30 dagen online',
                  'Account omgeving voor beheer van sollicitaties',
                  'Inzet van vacature alert(s)',
                  'Nieuwsbrief plaatsing',
                  'Social media plaatsing',
                ]}
                ctaHref={mailto}
              />

              {/* Card 2 - Op aanvraag (highlighted, brand) */}
              <PriceCard
                title="Online vacatureplaatsing & social campagne"
                price="Op aanvraag"
                features={[
                  'Online vacatureplaatsing',
                  'Bereik latent werkzoekenden',
                  'Doelgroepanalyse',
                  'Contentcreatie',
                  'Monitoring en optimalisatie',
                ]}
                disclaimer="Vraag vrijblijvend een prijsvoorstel aan! Op basis van de functie kunnen wij passend advies geven."
                ctaHref={mailto}
                highlighted
              />

              {/* Card 3 - Onbeperkt online (Gratis) */}
              <PriceCard
                title="Onbeperkt online"
                price="Gratis"
                features={[
                  'Onbeperkt vacatures plaatsen',
                  'Geen vaste looptijd',
                  'Eigen bedrijfsprofiel-pagina',
                  'Account omgeving',
                  'Volledige integratie met je ATS',
                ]}
                disclaimer="Vraag vrijblijvend een prijsvoorstel aan! Op basis van de advertentietekst kunnen wij passend advies geven."
                ctaHref={mailto}
              />
            </div>

            <p className="mt-10 text-center text-meta font-light text-body">
              Heb je meerdere vacatures? Neem dan vrijblijvend contact met ons op en vraag naar de mogelijkheden.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

function UspItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-secondary shrink-0 mt-0.5"
      >
        <Check className="h-3.5 w-3.5 text-secondary" strokeWidth={2.5} />
      </span>
      <span className="text-body font-regular text-primary leading-snug">
        {children}
      </span>
    </li>
  )
}

interface PriceCardProps {
  title: string
  price: string
  features: string[]
  disclaimer?: string
  ctaHref: string
  highlighted?: boolean
}

function PriceCard({
  title,
  price,
  features,
  disclaimer,
  ctaHref,
  highlighted,
}: PriceCardProps) {
  const containerClass = highlighted
    ? 'bg-primary text-primary-ink ring-1 ring-primary'
    : 'bg-surface text-primary border border-divider'

  const titleClass = highlighted ? 'text-primary-ink' : 'text-primary'
  const priceClass = highlighted ? 'text-primary-ink' : 'text-primary'
  const featureTextClass = highlighted ? 'text-primary-ink' : 'text-primary'
  const featureIconClass = highlighted ? 'text-primary-ink' : 'text-secondary'
  const disclaimerClass = highlighted ? 'text-primary-ink/80' : 'text-body'

  return (
    <div className={`flex flex-col rounded-card shadow-card ${containerClass}`}>
      <div className="px-6 pt-8 pb-6 flex flex-col items-center">
        {highlighted && (
          <div className="flex items-center gap-3 mb-5" aria-hidden="true">
            <Instagram className="h-6 w-6" strokeWidth={1.75} />
            <Facebook className="h-6 w-6" strokeWidth={1.75} />
            <Linkedin className="h-6 w-6" strokeWidth={1.75} />
          </div>
        )}
        <h3
          className={`m-0 text-h3 font-bold tracking-tight text-center text-balance ${titleClass}`}
        >
          {title}
        </h3>
        <p className={`m-0 mt-6 text-h1 font-bold tracking-tight ${priceClass}`}>
          {price}
        </p>
      </div>

      <ul className="px-6 pb-6 space-y-3 m-0 list-none flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <Check
              className={`h-4 w-4 shrink-0 mt-1 ${featureIconClass}`}
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <span className={`text-meta font-regular ${featureTextClass}`}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {disclaimer && (
        <p
          className={`mx-6 mb-5 text-small italic leading-relaxed text-center ${disclaimerClass}`}
        >
          {disclaimer}
        </p>
      )}

      <div className="px-6 pb-6 mt-auto">
        <a
          href={ctaHref}
          className={
            highlighted
              ? 'block w-full text-center h-11 leading-[44px] rounded-button bg-secondary text-secondary-ink text-meta font-bold tracking-tight transition-colors hover:bg-secondary-hover'
              : 'block w-full text-center h-11 leading-[44px] rounded-button bg-secondary text-secondary-ink text-meta font-bold tracking-tight transition-colors hover:bg-secondary-hover'
          }
        >
          Kies dit pakket
        </a>
      </div>
    </div>
  )
}
