'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, Bookmark } from 'lucide-react'
import { Wordmark } from './wordmark'

interface MobileMenuProps {
  /** Tenant-naam voor de wordmark in de drawer-header. */
  tenantName: string
}

const NAV_ITEMS = [
  { label: 'Vacatures',  href: '/vacatures' },
  { label: 'Bedrijven',  href: '/bedrijven' },
  { label: 'Werkgevers', href: '/werkgevers' },
  { label: 'Hulp',       href: '/contact' },
]

/**
 * Hamburger + slide-in drawer voor mobile/tablet (<lg breakpoint).
 * Behaviors:
 *  - ESC sluit
 *  - click-outside (overlay) sluit
 *  - body-scroll-lock terwijl open
 *  - drawer schakelt naar `aria-hidden` voor a11y wanneer dicht
 */
export function MobileMenu({ tenantName }: MobileMenuProps) {
  const [open, setOpen] = useState(false)

  // ESC + body-scroll-lock
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        className="lg:hidden inline-flex items-center justify-center min-w-11 min-h-11 rounded-md text-primary hover:bg-primary-tint transition-colors"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-6" strokeWidth={2} aria-hidden="true" />
      </button>

      <div
        className="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Hoofdnavigatie"
        aria-hidden={!open}
        style={{ pointerEvents: open ? 'auto' : 'none' }}
      >
        {/* Overlay */}
        <button
          type="button"
          aria-label="Sluit menu"
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-[rgba(15,23,42,0.45)] transition-opacity duration-200"
          style={{ opacity: open ? 1 : 0 }}
          tabIndex={open ? 0 : -1}
        />

        {/* Drawer-paneel */}
        <div
          className="absolute right-0 top-0 bottom-0 w-[min(360px,90vw)] bg-surface flex flex-col transition-transform duration-250 ease-eyeron"
          style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
        >
          <div className="flex items-center justify-between px-5 h-16 border-b border-divider-subtle">
            <Wordmark name={tenantName} className="text-lg" />
            <button
              type="button"
              className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-md text-primary hover:bg-primary-tint"
              aria-label="Sluit menu"
              onClick={() => setOpen(false)}
            >
              <X className="size-6" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-5 py-4">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-3 px-3 rounded-md text-h3 font-regular text-primary hover:bg-primary-tint"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="px-5 py-4 border-t border-divider-subtle">
            <Link
              href="/account/opgeslagen"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 py-3 px-3 rounded-md text-meta font-bold text-primary hover:bg-primary-tint"
            >
              <Bookmark className="size-5" strokeWidth={1.75} aria-hidden="true" />
              Opgeslagen vacatures
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
