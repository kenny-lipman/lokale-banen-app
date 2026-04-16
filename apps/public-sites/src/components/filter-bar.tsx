import { Suspense } from 'react'
import Link from 'next/link'
import { GeolocateButton } from './geolocate-button'

const TYPE_CHIPS = [
  { label: 'Alle', value: '' },
  { label: 'Vast', value: 'vast' },
  { label: 'Tijdelijk', value: 'tijdelijk' },
  { label: 'Fulltime', value: 'fulltime' },
  { label: 'Parttime', value: 'parttime' },
  { label: 'Stage', value: 'stage' },
]

interface FilterBarProps {
  activeType?: string
  query?: string
  location?: string
  sort?: string
  lat?: string
  lng?: string
}

/**
 * Sticky filter chips bar — sits below the EditorialSearchBar.
 * Renders dienstverband type chips as links (preserves URL params) + GeolocateButton.
 * Height: 44px (used in split-view height calc: 100vh - 56px header - 44px = calc(100vh - 100px)).
 *
 * Chip links preserve: q, location, lat, lng, sort (page is intentionally reset to 1).
 * 'nearest' sort is auto-cleared when lat/lng are absent (sort-select handles display).
 */
export function FilterBar({ activeType, query, location, sort, lat, lng }: FilterBarProps) {
  function chipHref(type: string) {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (location) params.set('location', location)
    if (lat) params.set('lat', lat)
    if (lng) params.set('lng', lng)
    // Preserve sort — but 'nearest' without location makes no sense; let the sort-select handle it
    if (sort && sort !== 'newest') params.set('sort', sort)
    if (type) params.set('type', type)
    const qs = params.toString()
    return qs ? `/?${qs}` : '/'
  }

  return (
    <div
      className="sticky top-[48px] lg:top-[56px] z-30 bg-surface"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 h-[44px] px-4 lg:px-6 overflow-x-auto scrollbar-none">
        {TYPE_CHIPS.map((chip) => {
          const isActive = chip.value === (activeType || '')
          return (
            <Link
              key={chip.value}
              href={chipHref(chip.value)}
              className="shrink-0 inline-flex items-center whitespace-nowrap h-7 px-3 rounded-full transition-colors"
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: isActive ? 'var(--primary-tint)' : 'transparent',
                color: isActive ? 'var(--primary-dark)' : 'var(--text-muted)',
              }}
            >
              {chip.label}
            </Link>
          )
        })}

        {/* Geolocate chip — right side */}
        <div className="ml-auto shrink-0">
          <Suspense fallback={null}>
            <GeolocateButton />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
