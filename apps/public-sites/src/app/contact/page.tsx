import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Phone, Instagram, Facebook, Linkedin } from 'lucide-react'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { COMPANY_INFO } from '@/lib/company-info'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  ContactForm,
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
        <p className="text-meta font-light text-muted">Platform niet gevonden.</p>
      </div>
    )
  }

  const cities = await getCitiesWithJobCounts(tenant.id)
  const socials = [
    { label: 'LinkedIn', href: tenant.social_linkedin, icon: Linkedin },
    { label: 'Facebook', href: tenant.social_facebook, icon: Facebook },
    { label: 'Instagram', href: tenant.social_instagram, icon: Instagram },
  ].filter((s) => s.href)

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

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-14 mt-10">
          {/* ── Form ── */}
          <section aria-labelledby="form-heading">
            <h2
              id="form-heading"
              className="m-0 text-h2 font-bold text-primary tracking-tight"
            >
              Stuur ons een bericht
            </h2>
            <p className="m-0 mt-2 mb-6 text-meta font-light text-muted max-w-prose">
              Vul het formulier in en we nemen zo snel mogelijk contact met je op.
            </p>
            <ContactForm />
          </section>

          {/* ── Contact-info sidebar ── */}
          <aside className="space-y-8 lg:pt-12">
            {/* Direct contact */}
            <div>
              <h3 className="m-0 text-h3 font-bold text-primary tracking-tight mb-3">
                Direct contact
              </h3>
              <ul className="space-y-3 m-0 p-0 list-none">
                <ContactInfoRow icon={Mail} href={`mailto:${COMPANY_INFO.centralEmail}`}>
                  {COMPANY_INFO.centralEmail}
                </ContactInfoRow>
                {tenant.contact_phone && (
                  <ContactInfoRow icon={Phone} href={`tel:${tenant.contact_phone}`}>
                    {tenant.contact_phone}
                  </ContactInfoRow>
                )}
              </ul>
            </div>

            {/* Volg ons */}
            {socials.length > 0 && (
              <div>
                <h3 className="m-0 text-h3 font-bold text-primary tracking-tight mb-3">
                  Volg ons
                </h3>
                <ul className="flex items-center gap-3 m-0 p-0 list-none">
                  {socials.map((social) => (
                    <li key={social.label}>
                      <a
                        href={social.href!}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${tenant.name} op ${social.label}`}
                        className="inline-flex items-center justify-center size-11 rounded-button border border-divider text-primary hover:bg-primary-tint hover:border-primary transition-colors"
                      >
                        <social.icon
                          className="size-5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bedrijfsgegevens */}
            <div>
              <h3 className="m-0 text-h3 font-bold text-primary tracking-tight mb-3">
                Bedrijfsgegevens
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-meta">
                <dt className="font-light text-muted">KvK</dt>
                <dd className="m-0 font-regular text-primary">
                  {COMPANY_INFO.kvkNumber}
                </dd>
                <dt className="font-light text-muted">BTW</dt>
                <dd className="m-0 font-regular text-primary">
                  {COMPANY_INFO.btwNumber}
                </dd>
              </dl>
            </div>

            {/* Sollicitatie-redirect note */}
            <div className="bg-surface border border-divider-subtle p-4 rounded-card">
              <p className="m-0 text-meta font-light text-muted leading-relaxed">
                Vragen over een specifieke vacature? Neem direct contact op met de
                werkgever. De contactgegevens vind je op de vacaturepagina.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

function ContactInfoRow({
  icon: Icon,
  href,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  href?: string
  children: React.ReactNode
}) {
  const content = (
    <span className="inline-flex items-center gap-3">
      <span className="inline-flex items-center justify-center size-9 shrink-0 bg-primary-tint rounded-button">
        <Icon className="size-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="text-meta font-regular text-primary leading-relaxed">
        {children}
      </span>
    </span>
  )
  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="block hover:text-primary-hover transition-colors"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  )
}
