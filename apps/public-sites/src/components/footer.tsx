import Link from 'next/link'
import { Linkedin, Instagram, Facebook, Twitter } from 'lucide-react'
import type { Tenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'

interface FooterProps {
  tenant: Tenant
  /** Hide footer on desktop — kept for backward compat but defaults to false */
  hiddenOnDesktop?: boolean
}

/**
 * Editorial footer — 4 columns + network links.
 * Background: var(--foreground) (#1A1815)
 */
export async function Footer({ tenant, hiddenOnDesktop = false }: FooterProps) {
  const allCities = await getCitiesWithJobCounts(tenant.id)
  const topCities = allCities.slice(0, 5)

  const hasSocials =
    tenant.social_linkedin ||
    tenant.social_instagram ||
    tenant.social_facebook ||
    tenant.social_tiktok ||
    tenant.social_twitter

  return (
    <footer
      className={hiddenOnDesktop ? 'lg:hidden' : undefined}
      style={{
        backgroundColor: 'var(--foreground)',
        color: 'var(--bg)',
        padding: '48px var(--pad) 28px',
      }}
    >
      <div style={{ maxWidth: 'var(--max)', margin: '0 auto' }}>
        {/* 4-column grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-10 pb-9"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {/* Column 1: Brand */}
          <div className="col-span-2 sm:col-span-1">
            <p
              className="font-display"
              style={{
                fontSize: '1.35rem',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                marginBottom: 10,
                lineHeight: 1.2,
              }}
            >
              {tenant.name}
            </p>
            <p
              style={{
                color: 'rgba(250, 248, 244, 0.6)',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                maxWidth: '28ch',
              }}
            >
              Onderdeel van het LokaleBanen-netwerk. 53 regionale sites, één
              missie: werk dichtbij huis vinden.
            </p>
            {/* Social icons */}
            {hasSocials && (
              <div className="flex items-center gap-4 mt-5">
                {tenant.social_linkedin && (
                  <SocialLink href={tenant.social_linkedin} label="LinkedIn">
                    <Linkedin className="h-5 w-5" />
                  </SocialLink>
                )}
                {tenant.social_instagram && (
                  <SocialLink href={tenant.social_instagram} label="Instagram">
                    <Instagram className="h-5 w-5" />
                  </SocialLink>
                )}
                {tenant.social_facebook && (
                  <SocialLink href={tenant.social_facebook} label="Facebook">
                    <Facebook className="h-5 w-5" />
                  </SocialLink>
                )}
                {tenant.social_tiktok && (
                  <SocialLink href={tenant.social_tiktok} label="TikTok">
                    <TikTokIcon className="h-5 w-5" />
                  </SocialLink>
                )}
                {tenant.social_twitter && (
                  <SocialLink href={tenant.social_twitter} label="Twitter">
                    <Twitter className="h-5 w-5" />
                  </SocialLink>
                )}
              </div>
            )}
          </div>

          {/* Column 2: Werkzoekenden */}
          <div>
            <FooterHeading>Werkzoekenden</FooterHeading>
            <ul className="space-y-1">
              <li><FooterLink href="/">Vacatures zoeken</FooterLink></li>
              {topCities.map(({ city, slug }) => (
                <li key={slug}>
                  <FooterLink href={`/vacatures/${slug}`}>{city}</FooterLink>
                </li>
              ))}
              <li><FooterLink href="/account/opgeslagen">Opgeslagen vacatures</FooterLink></li>
            </ul>
          </div>

          {/* Column 3: Werkgevers */}
          <div className="hidden sm:block">
            <FooterHeading>Werkgevers</FooterHeading>
            <ul className="space-y-1">
              <li><FooterLink href="/werkgevers">Plaats vacature</FooterLink></li>
              <li><FooterLink href="/werkgevers">Tarieven</FooterLink></li>
              <li><FooterLink href="/werkgevers">Succesverhalen</FooterLink></li>
            </ul>
          </div>

          {/* Column 4: Over */}
          <div>
            <FooterHeading>Over</FooterHeading>
            <ul className="space-y-1">
              <li><FooterLink href="/over-ons">Over ons</FooterLink></li>
              <li><FooterLink href="/contact">Contact</FooterLink></li>
              <li><FooterLink href="/privacy">Privacy</FooterLink></li>
              <li><FooterLink href="/voorwaarden">Voorwaarden</FooterLink></li>
            </ul>
          </div>
        </div>

        {/* Bottom row: copyright + network */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 pt-5"
          style={{ fontSize: '0.75rem', color: 'rgba(250, 248, 244, 0.45)' }}
        >
          <div>&copy; {new Date().getFullYear()} {tenant.name} &middot; Alle rechten voorbehouden</div>
          <div className="flex flex-wrap gap-4">
            <span style={{ color: 'rgba(250, 248, 244, 0.6)' }}>LokaleBanen-netwerk</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(250, 248, 244, 0.65)',
        marginBottom: 14,
      }}
    >
      {children}
    </h4>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="transition-colors hover:text-white"
      style={{ color: 'rgba(250, 248, 244, 0.82)', fontSize: '0.875rem' }}
    >
      {children}
    </Link>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="transition-colors hover:text-white"
      style={{ color: 'rgba(250, 248, 244, 0.8)' }}
      aria-label={label}
    >
      {children}
    </a>
  )
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.98a8.18 8.18 0 0 0 4.76 1.52V7.05a4.83 4.83 0 0 1-1-.36z" />
    </svg>
  )
}
