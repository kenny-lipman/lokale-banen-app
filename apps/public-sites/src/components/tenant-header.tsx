import Link from 'next/link'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { UserNav } from './user-nav'
import type { Tenant } from '@/lib/tenant'

interface TenantHeaderProps {
  tenant: Tenant
  showSearch?: boolean
  defaultQuery?: string
  defaultLocation?: string
}

/**
 * Sticky header: 56px desktop, 48px mobile.
 * Logo left, single search field center (desktop only), user icon right.
 */
export function TenantHeader({
  tenant,
  showSearch = true,
  defaultQuery,
  defaultLocation,
}: TenantHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 bg-surface"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Desktop: h-[56px] px-6 py-3 */}
      {/* Mobile: h-[48px] px-4 py-2 */}
      <div className="flex items-center justify-between h-[48px] px-4 lg:h-[56px] lg:px-6 lg:py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={`${tenant.name} logo`}
              width={120}
              height={32}
              className="h-6 w-auto lg:h-8 object-contain"
            />
          ) : (
            <div className="h-6 w-6 lg:h-8 lg:w-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-[10px] lg:text-[11px] font-bold text-primary-foreground">
                {(tenant.name || 'LB').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <span className="font-semibold text-body hidden sm:inline text-foreground">
            {tenant.hero_title || tenant.name}
          </span>
        </Link>

        {/* Desktop inline search — single field */}
        {showSearch && (
          <div className="hidden lg:flex flex-1 max-w-[480px] mx-6">
            <form action="/" method="GET" className="w-full">
              {/* Preserve location param if set */}
              {defaultLocation && (
                <input type="hidden" name="location" value={defaultLocation} />
              )}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name="q"
                  placeholder="Zoek op functie, bedrijf..."
                  defaultValue={defaultQuery}
                  className="flex h-10 w-full rounded-lg bg-background px-3 py-2 pl-9 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-light)]"
                  style={{ border: '1px solid var(--border)' }}
                  aria-label="Zoek op functie of bedrijf"
                />
              </div>
            </form>
          </div>
        )}

        {/* User icon — 32px on mobile */}
        <UserNav />
      </div>
    </header>
  )
}
