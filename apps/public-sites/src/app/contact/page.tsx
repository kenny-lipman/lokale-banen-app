import type { Metadata } from 'next'
import { Mail, Phone } from 'lucide-react'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
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
    title: `Contact | ${tenant?.name || 'Lokale Banen'}`,
    description: `Neem contact op met ${tenant?.name || 'ons'}`,
    alternates: {
      canonical: tenant?.domain ? `https://${tenant.domain}/contact` : undefined,
    },
  }
}

export default async function ContactPage() {
  const tenant = await getTenant()
  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-meta font-light text-body">Platform niet gevonden.</p>
      </div>
    )
  }

  const cities = await getCitiesWithJobCounts(tenant.id)
  const hasContact = !!(tenant.contact_email || tenant.contact_phone)

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: tenant.name, href: '/' }, { label: 'Contact' }]}
        />
        <PageHero
          title={`Neem contact op met ${tenant.name}`}
          description="We helpen je graag verder met vragen over ons platform of het netwerk."
        />

        {hasContact ? (
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            {tenant.contact_email && (
              <ContactCard
                icon={Mail}
                label="E-mail"
                value={tenant.contact_email}
                href={`mailto:${tenant.contact_email}`}
              />
            )}
            {tenant.contact_phone && (
              <ContactCard
                icon={Phone}
                label="Telefoon"
                value={tenant.contact_phone}
                href={`tel:${tenant.contact_phone}`}
              />
            )}
          </div>
        ) : (
          <p className="text-meta font-light text-body max-w-prose">
            Er zijn nog geen contactgegevens beschikbaar voor dit platform.
          </p>
        )}

        <div className="mt-8 max-w-2xl bg-surface border border-divider-subtle p-5">
          <p className="m-0 text-meta font-light text-body leading-relaxed">
            Voor vragen over een specifieke vacature verwijzen wij naar de werkgever
            zelf — de contactgegevens vind je op de vacaturepagina onder &ldquo;Over {' '}
            {'{bedrijf}'}&rdquo;.
          </p>
        </div>

        <div className="mt-10 pt-8 border-t border-divider-subtle">
          <PillButton href="/">
            Naar de vacatures
            <ArrowRight />
          </PillButton>
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value: string
  href: string
}) {
  return (
    <a
      href={href}
      className="block bg-surface border border-divider-subtle p-5 hover:shadow-card-hover transition-shadow group"
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex items-center justify-center w-11 h-11 bg-primary-tint shrink-0">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-small font-light uppercase tracking-[0.06em] text-body">
            {label}
          </p>
          <p className="m-0 mt-1 text-body font-bold text-primary tracking-tight group-hover:text-primary-hover">
            {value}
          </p>
        </div>
      </div>
    </a>
  )
}
