'use client'

import { Search, MapPin, ArrowRight } from 'lucide-react'
import { useState } from 'react'

interface EditorialSearchBarProps {
  /** Default value for the "Wat" field. */
  defaultQuery?: string
  /** Default value for the "Waar" field. */
  defaultLocation?: string
  /** Form action URL — defaults to '/'. */
  action?: string
  /** Optional placeholder for what field. */
  queryPlaceholder?: string
  /** Optional placeholder for where field. */
  locationPlaceholder?: string
  /** Active geolocation latitude — preserved as hidden input so distance chips survive search. */
  lat?: string
  /** Active geolocation longitude — preserved as hidden input so distance chips survive search. */
  lng?: string
}

/**
 * Editorial two-field search bar: "Wat" + "Waar" with submit CTA.
 *
 * Renders as a rounded pill form with three cells separated by 1px rules
 * (via a 1-gap grid on `--border`). On mobile the cells stack vertically.
 *
 * Uses a GET form so Next.js routing handles submission naturally.
 * Client component because the submit button needs hover-color handling
 * that respects tenant theme vars.
 */
export function EditorialSearchBar({
  defaultQuery = '',
  defaultLocation = '',
  action = '/',
  queryPlaceholder = 'Functie, vaardigheid of bedrijf',
  locationPlaceholder = 'Postcode of plaats',
  lat,
  lng,
}: EditorialSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <section
      className="mx-auto"
      style={{ maxWidth: 'var(--max)', padding: '4px var(--pad) 20px' }}
      aria-label="Vacature zoeken"
    >
      <form
        action={action}
        method="GET"
        className="grid overflow-hidden transition-all grid-cols-1 md:grid-cols-[1.5fr_1fr_auto]"
        style={{
          gap: 1,
          background: 'var(--border)',
          border: `1px solid ${isFocused ? 'var(--primary)' : 'var(--border-strong)'}`,
          borderRadius: 14,
          boxShadow: isFocused
            ? '0 0 0 3px var(--primary-tint), var(--shadow-sm)'
            : 'var(--shadow-sm)',
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          // Only leave focused state when focus moves outside the form
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsFocused(false)
          }
        }}
      >
        {/* Wat */}
        <label
          className="flex items-center gap-2.5 transition-colors hover:bg-surface-2"
          style={{ background: 'var(--surface)', padding: '12px 18px' }}
        >
          <Search
            size={18}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          />
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold uppercase"
              style={{
                fontSize: '0.6875rem',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 2,
              }}
            >
              Wat
            </div>
            <input
              type="search"
              name="q"
              defaultValue={defaultQuery}
              placeholder={queryPlaceholder}
              aria-label="Functie, vaardigheid of bedrijf"
              className="w-full border-0 bg-transparent p-0 text-foreground outline-none placeholder:text-[var(--text-faint)]"
              style={{ fontSize: '0.9375rem' }}
            />
          </div>
        </label>

        {/* Waar */}
        <label
          className="flex items-center gap-2.5 transition-colors hover:bg-surface-2"
          style={{ background: 'var(--surface)', padding: '12px 18px' }}
        >
          <MapPin
            size={18}
            strokeWidth={1.75}
            aria-hidden="true"
            style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          />
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold uppercase"
              style={{
                fontSize: '0.6875rem',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                marginBottom: 2,
              }}
            >
              Waar
            </div>
            <input
              type="search"
              name="location"
              defaultValue={defaultLocation}
              placeholder={locationPlaceholder}
              aria-label="Postcode of plaats"
              className="w-full border-0 bg-transparent p-0 text-foreground outline-none placeholder:text-[var(--text-faint)]"
              style={{ fontSize: '0.9375rem' }}
            />
          </div>
        </label>

        {/* Preserve geolocation through search so distance chips + nearest sort survive */}
        {lat && <input type="hidden" name="lat" value={lat} />}
        {lng && <input type="hidden" name="lng" value={lng} />}

        {/* Submit */}
        <button
          type="submit"
          className="flex items-center justify-center gap-2 font-semibold transition-colors"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-ink)',
            padding: '14px 26px',
            fontSize: '0.9375rem',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background =
              'var(--primary-hover)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--primary)'
          }}
        >
          <span>Zoeken</span>
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
