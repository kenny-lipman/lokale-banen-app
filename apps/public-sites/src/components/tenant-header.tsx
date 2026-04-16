import Link from 'next/link'
import Image from 'next/image'
import { Bookmark } from 'lucide-react'
import { UserNav } from './user-nav'
import type { Tenant } from '@/lib/tenant'

interface TenantHeaderProps {
  tenant: Tenant
  showSearch?: boolean
  defaultQuery?: string
  defaultLocation?: string
}

const NAV_ITEMS = [
  { label: 'Vacatures', href: '/' },
  { label: 'Steden', href: '/vacatures' },
  { label: 'Bedrijven', href: '/bedrijven' },
  { label: 'Werkgevers', href: '/werkgevers' },
  { label: 'Hulp', href: '/contact' },
]

/**
 * Sticky header: 56px desktop, 48px mobile.
 * Logo left, nav center (desktop), bookmark + user right.
 */
export function TenantHeader({
  tenant,
  showSearch = true,
  defaultQuery,
  defaultLocation,
}: TenantHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40"
      style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
    >
      <div
        className="flex items-center justify-between mx-auto"
        style={{
          maxWidth: 'var(--max)',
          height: 56,
          padding: '0 var(--pad)',
        }}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          {tenant.logo_url ? (
            <Image
              src={tenant.logo_url}
              alt={`${tenant.name} logo`}
              width={200}
              height={36}
              className="h-7 w-auto lg:h-9 object-contain"
            />
          ) : (
            <>
              <div
                className="grid place-items-center font-bold"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--primary)',
                  color: 'var(--primary-ink)',
                  fontSize: '0.875rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {(tenant.name || 'LB').slice(0, 2).toUpperCase()}
              </div>
              <span className="font-semibold text-body hidden sm:inline text-foreground">
                {tenant.name}
              </span>
            </>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Hoofdnavigatie">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors"
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-2)',
                padding: '6px 2px',
                borderBottom: '1px solid transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/account/opgeslagen"
            className="hidden sm:grid place-items-center rounded-sm transition-colors"
            style={{ padding: 8 }}
            aria-label="Opgeslagen vacatures"
          >
            <Bookmark size={20} strokeWidth={1.75} style={{ color: 'var(--text-2)' }} />
          </Link>
          <UserNav />
        </div>
      </div>
    </header>
  )
}
