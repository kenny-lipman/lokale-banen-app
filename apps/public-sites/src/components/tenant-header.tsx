import Link from 'next/link'
import { SearchBar } from './search-bar'
import { UserNav } from './user-nav'
import type { Tenant } from '@/lib/tenant'

interface TenantHeaderProps {
  tenant: Tenant
  showSearch?: boolean
  defaultQuery?: string
  defaultLocation?: string
}

/**
 * Tenant-branded header with logo, inline search (desktop), and user nav.
 * Sticky at top, 56px on mobile, 72px on desktop (with inline search).
 * Search bar appears inline on desktop, below header on mobile.
 */
export function TenantHeader({
  tenant,
  showSearch = true,
  defaultQuery,
  defaultLocation,
}: TenantHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
      <div className="container">
        {/* Main header row */}
        <div className="flex items-center justify-between h-14 sm:h-[72px]">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt=""
                className="h-8 w-auto"
                aria-hidden="true"
              />
            ) : (
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">
                  {(tenant.name || 'LB').slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-semibold text-body hidden sm:inline">
              {tenant.hero_title || tenant.name}
            </span>
          </Link>

          {/* Desktop inline search */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-xl mx-6">
              <SearchBar
                defaultQuery={defaultQuery}
                defaultLocation={defaultLocation}
                tenantRegion={tenant.region}
              />
            </div>
          )}

          <UserNav />
        </div>

        {/* Mobile search below header */}
        {showSearch && (
          <div className="md:hidden pb-3">
            <SearchBar
              defaultQuery={defaultQuery}
              defaultLocation={defaultLocation}
              tenantRegion={tenant.region}
            />
          </div>
        )}
      </div>
    </header>
  )
}
