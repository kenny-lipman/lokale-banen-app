import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import type { Tenant } from '@/lib/tenant'
import { PortalLogo } from './portal-logo'
import { UserNav } from './user-nav'
import { MobileMenu } from './mobile-menu'

interface SiteHeaderProps {
  tenant: Tenant
}

const NAV_ITEMS = [
  { label: 'Vacatures',  href: '/' },
  { label: 'Steden',     href: '/vacatures' },
  { label: 'Bedrijven',  href: '/bedrijven' },
  { label: 'Werkgevers', href: '/werkgevers' },
  { label: 'Hulp',       href: '/contact' },
]

/**
 * Top header per Eyeron-spec: 99px desktop / 64px mobile, witte achtergrond,
 * logo links, nav rechts (>=lg), bookmark + user-actions, hamburger op mobile.
 *
 * Sticky positioning zodat search altijd binnen handbereik blijft op mobile —
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
    </header>
  )
}
