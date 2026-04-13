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
 * Compact tenant-branded header. Sticky, max ~120px.
 * Logo left, search dominant center, account right.
 */
export function TenantHeader({
  tenant,
  showSearch = true,
  defaultQuery,
  defaultLocation,
}: TenantHeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border">
      <div className="container">
        {/* Main header row */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt=""
                className="h-7 w-auto"
                aria-hidden="true"
              />
            ) : (
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-[11px] font-bold text-primary-foreground">
                  {(tenant.name || 'LB').slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-semibold text-body hidden sm:inline text-foreground">
              {tenant.hero_title || tenant.name}
            </span>
          </Link>

          {/* Desktop inline search */}
          {showSearch && (
            <div className="hidden md:flex flex-1 max-w-xl mx-6">
              <SearchBar
                defaultQuery={defaultQuery}
                defaultLocation={defaultLocation}
                tenantRegion={tenant.central_place}
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
              tenantRegion={tenant.central_place}
            />
          </div>
        )}
      </div>
    </header>
  )
}
