import Link from 'next/link'
import type { Tenant } from '@/lib/tenant'
import { MasterLogo, PortalLogo } from './portal-logo'

interface SiteFooterProps {
  tenant: Tenant
  /**
   * Top-N steden voor de Werkzoekenden-kolom. Per regio data-driven via
   * `getCitiesWithJobCounts(tenant.id)`.
   */
  cities: Array<{ city: string; slug: string }>
}

interface FooterLink {
  label: string
  href: string
}

const WERKGEVERS_LINKS: FooterLink[] = [
  { label: 'Plaats vacature', href: '/werkgevers' },
  { label: 'Tarieven',        href: '/werkgevers/pakketten' },
]

const OVER_LINKS: FooterLink[] = [
  { label: 'Over ons',     href: '/over-ons' },
  { label: 'Contact',      href: '/contact' },
  { label: 'Privacy',      href: '/privacy' },
  { label: 'Voorwaarden',  href: '/voorwaarden' },
]

/**
 * Footer per Eyeron-spec: primary bg, 4 kolommen op desktop
 * (brand+tagline | Werkzoekenden | Werkgevers | Over LokaleBanen),
 * 2 kolommen op tablet, 1 op mobile. Master-logo rechts-onder.
 *
 * Voor de master-tenant (lokalebanen.nl) wordt de master-logo niet getoond
 * (het is per definitie het merk zelf).
 */
export function SiteFooter({ tenant, cities }: SiteFooterProps) {
  const isMaster = tenant.tier === 'master'
  const topCities = cities.slice(0, 5)

  return (
    <footer className="bg-primary text-on-dark mt-auto">
      <div className="max-w-content mx-auto px-pad pt-14 pb-7">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-8 sm:gap-9 pb-9 border-b border-[rgba(255,255,255,0.18)]">
          {/* Brand-kolom - logo i.p.v. tekst (Joost-feedback). brightness-0+invert
             rendert zowel pre-processed SVG met var(--primary) als uploaded
             tenant.logo_url universeel in wit. */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-3.5">
              <PortalLogo
                tenantName={tenant.name}
                logoUrl={tenant.logo_url}
                height={42}
                className="brightness-0 invert"
              />
            </div>
            <p className="text-meta font-light leading-relaxed max-w-[24ch]">
              Onderdeel van het LokaleBanen-netwerk. Tientallen regionale sites,
              één missie: werk dichtbij huis vinden.
            </p>
          </div>

          {/* Werkzoekenden - data-driven steden */}
          <FooterColumn heading="Werkzoekenden">
            <FooterLinkItem href="/">Vacatures zoeken</FooterLinkItem>
            {topCities.map(({ city, slug }) => (
              <FooterLinkItem key={slug} href={`/vacatures/${slug}`}>
                {city}
              </FooterLinkItem>
            ))}
            <FooterLinkItem href="/account/opgeslagen">
              Opgeslagen vacatures
            </FooterLinkItem>
          </FooterColumn>

          <FooterColumn heading="Werkgevers">
            {WERKGEVERS_LINKS.map((l) => (
              <FooterLinkItem key={l.label} href={l.href}>
                {l.label}
              </FooterLinkItem>
            ))}
          </FooterColumn>

          <FooterColumn heading="Over LokaleBanen">
            {OVER_LINKS.map((l) => (
              <FooterLinkItem key={l.label} href={l.href}>
                {l.label}
              </FooterLinkItem>
            ))}
          </FooterColumn>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-5">
          <p className="text-small font-light text-on-dark m-0" suppressHydrationWarning>
            © {new Date().getFullYear()} {tenant.name} · Alle rechten voorbehouden
          </p>
          {!isMaster && (
            <Link
              href="https://lokalebanen.nl"
              className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
              aria-label="LokaleBanen netwerk"
            >
              <MasterLogo height={33} className="brightness-0 invert" />
            </Link>
          )}
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="text-meta font-bold mb-3 tracking-tight">{heading}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function FooterLinkItem({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <li className="leading-[30px]">
      <Link
        href={href}
        className="text-meta font-bold text-on-dark hover:underline underline-offset-2"
      >
        {children}
      </Link>
    </li>
  )
}
