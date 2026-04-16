import { Suspense } from 'react'
import { Search, MapPin } from 'lucide-react'
import { DesktopFilterSelect } from './filter-select'
import { GeolocateButton } from './geolocate-button'
import type { Tenant } from '@/lib/tenant'

const DIENSTVERBAND_OPTIONS = [
  { label: 'Dienstverband', value: '' },
  { label: 'Vast', value: 'vast' },
  { label: 'Tijdelijk', value: 'tijdelijk' },
  { label: 'Fulltime', value: 'fulltime' },
  { label: 'Parttime', value: 'parttime' },
  { label: 'Stage', value: 'stage' },
] as const

interface FilterBarProps {
  filters: {
    query?: string
    location?: string
    type?: string
  }
  tenant: Tenant
}

/**
 * Filter bar: 52px, sticky below header (top: 56px desktop).
 * Desktop: function input + location input + dienstverband dropdown.
 * Mobile: two inputs on first row, horizontal scroll chips on second row.
 * All filters via URL searchParams (GET form).
 */
export function FilterBar({ filters, tenant }: FilterBarProps) {
  return (
    <div
      className="sticky top-[48px] lg:top-[56px] z-30 bg-surface"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {/* Desktop filter bar */}
      <div className="hidden lg:flex items-center gap-2 h-[52px] px-6 py-2">
        <form action="/" method="GET" className="flex items-center gap-2 flex-1">
          {/* Functie input */}
          <div className="relative flex-1 max-w-[240px]">
            <Search
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              placeholder="Functie..."
              defaultValue={filters.query}
              className="flex h-9 w-full rounded-lg bg-background pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-light)]"
              style={{ border: '1px solid var(--border)' }}
              aria-label="Zoek op functie"
            />
          </div>

          {/* Locatie input */}
          <div className="relative flex-1 max-w-[200px]">
            <MapPin
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              name="location"
              placeholder={tenant.central_place || 'Locatie...'}
              defaultValue={filters.location}
              className="flex h-9 w-full rounded-lg bg-background pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-light)]"
              style={{ border: '1px solid var(--border)' }}
              aria-label="Zoek op locatie"
            />
          </div>

          {/* Dienstverband dropdown (pill) */}
          <DesktopFilterSelect
            name="type"
            value={filters.type || ''}
            options={DIENSTVERBAND_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
            isActive={!!filters.type}
          />

          {/* Submit button for filter bar */}
          <button
            type="submit"
            className="h-9 px-4 text-button rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Zoeken
          </button>
        </form>

        {/* Geolocation button — outside the form, updates URL directly */}
        <Suspense fallback={null}>
          <GeolocateButton />
        </Suspense>
      </div>

      {/* Mobile filter bar */}
      <div className="lg:hidden px-4 py-2 space-y-2">
        <form action="/" method="GET">
          {/* Row 1: function + location inputs */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                placeholder="Functie..."
                defaultValue={filters.query}
                className="flex h-9 w-full rounded-lg bg-background pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary"
                style={{ border: '1px solid var(--border)' }}
                aria-label="Zoek op functie"
              />
            </div>
            <div className="relative flex-1">
              <MapPin
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                name="location"
                placeholder={tenant.central_place || 'Locatie...'}
                defaultValue={filters.location}
                className="flex h-9 w-full rounded-lg bg-background pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary"
                style={{ border: '1px solid var(--border)' }}
                aria-label="Zoek op locatie"
              />
            </div>
          </div>

          {/* Row 2: horizontal scroll chips */}
          <MobileFilterChips activeType={filters.type} />

          <button type="submit" className="sr-only">Zoeken</button>
        </form>
      </div>
    </div>
  )
}

/**
 * Mobile filter chips — horizontal scroll.
 */
function MobileFilterChips({ activeType }: { activeType?: string }) {
  const chips = [
    { label: 'Alle', value: '' },
    { label: 'Vast', value: 'vast' },
    { label: 'Tijdelijk', value: 'tijdelijk' },
    { label: 'Fulltime', value: 'fulltime' },
    { label: 'Parttime', value: 'parttime' },
    { label: 'Stage', value: 'stage' },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 py-1">
      {chips.map((chip) => {
        const isActive = chip.value === (activeType || '')
        return (
          <label
            key={chip.value}
            className="shrink-0 cursor-pointer"
          >
            <input
              type="radio"
              name="type"
              value={chip.value}
              defaultChecked={isActive}
              className="sr-only"
            />
            <span
              className="inline-flex items-center whitespace-nowrap h-8 px-3 text-meta font-medium rounded-[18px] transition-colors"
              style={{
                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                backgroundColor: isActive ? 'var(--primary-light)' : 'var(--surface)',
                color: isActive ? 'var(--primary)' : 'var(--foreground)',
              }}
            >
              {chip.label}
            </span>
          </label>
        )
      })}
    </div>
  )
}
