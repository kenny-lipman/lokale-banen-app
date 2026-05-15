import Link from 'next/link'
import { Bookmark, PlusCircle } from 'lucide-react'
import type { Tenant } from '@/lib/tenant'
import { PortalLogo } from './portal-logo'
import { UserNav } from './user-nav'
import { MobileMenu } from './mobile-menu'

interface SiteHeaderProps {
  tenant: Tenant
}

const NAV_ITEMS = [
  { label: 'Vacatures',  href: '/vacatures' },
  { label: 'Bedrijven',  href: '/bedrijven' },
  { label: 'Werkgevers', href: '/werkgevers' },
  { label: 'Hulp',       href: '/contact' },
]

/**
 * Top header per Eyeron-spec: 99px desktop / 64px mobile, witte achtergrond,
 * logo links, nav rechts (>=lg), bookmark + user-actions, hamburger op mobile.
 *
 * Sticky positioning zodat search altijd binnen handbereik blijft op mobile -
 * standaard UX-pattern voor job-boards.
 */
export function SiteHeader({ tenant }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-surface h-header-mob lg:h-header-desk shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="max-w-content mx-auto h-full px-pad flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0" aria-label="Naar de homepage">
          <PortalLogo
            tenantName={tenant.name}
            logoUrl={tenant.logo_url}
            height={48}
            className="lg:h-[56px]"
          />
        </Link>

        <div className="flex items-center gap-4 lg:gap-6">
          <nav
            aria-label="Hoofdnavigatie"
            className="hidden lg:flex items-center gap-7"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-body font-regular text-secondary hover:text-secondary-hover hover:underline underline-offset-4 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/werkgevers/pakketten"
            className="hidden md:inline-flex items-center gap-2 h-11 px-[22px] rounded-button bg-secondary text-secondary-ink text-meta font-bold tracking-tight transition-colors hover:bg-secondary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary focus-visible:outline-offset-2"
          >
            <PlusCircle className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Vacature plaatsen
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/account/opgeslagen"
              aria-label="Opgeslagen vacatures"
              className="hidden sm:inline-flex items-center justify-center min-w-11 min-h-11 rounded-md text-primary hover:bg-primary-tint transition-colors"
            >
              <Bookmark className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
            <UserNav />
            <MobileMenu tenantName={tenant.name} />
          </div>
        </div>
      </div>
    </header>
  )
}
