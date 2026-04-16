import Image from 'next/image'
import type { Tenant } from '@/lib/tenant'
import type { FilterFacets } from '@/lib/queries'
import { FilterGroup } from './filter-group'
import { ActiveFilters } from './active-filters'

interface FilterSidebarProps {
  tenant: Tenant
  facets: FilterFacets
  activeType?: string
  activeHours?: string
  activeEducation?: string
  activeSector?: string
  activeDistance?: string
  totalJobs: number
}

export interface FilterGroupsProps {
  facets: FilterFacets
  activeType?: string
  activeHours?: string
  activeEducation?: string
  activeSector?: string
  activeDistance?: string
}

const HOURS_LABELS: Record<string, string> = {
  lt32: 'Parttime < 32u',
  '32-40': 'Fulltime 32–40u',
  gt40: 'Meer dan 40u',
}

const DISTANCE_OPTIONS = [
  { value: '5', label: 'Binnen 5 km', count: 0 },
  { value: '15', label: 'Binnen 15 km', count: 0 },
  { value: '25', label: 'Binnen 25 km', count: 0 },
  { value: 'all', label: 'Heel de regio', count: 0 },
]

/** Shared helper: map facets to option arrays. */
function buildFilterOptions(facets: FilterFacets) {
  const employmentOptions = facets.employment.map((f) => ({
    value: f.value.toLowerCase(),
    label: f.value.charAt(0).toUpperCase() + f.value.slice(1),
    count: f.count,
  }))

  const educationOptions = facets.education.map((f) => ({
    value: f.value,
    label: f.value,
    count: f.count,
  }))

  const sectorOptions = facets.sector.slice(0, 10).map((f) => ({
    value: f.value,
    label: f.value,
    count: f.count,
  }))

  const hoursOptions = facets.hours.map((f) => ({
    value: f.value,
    label: HOURS_LABELS[f.value] || f.value,
    count: f.count,
  }))

  return { employmentOptions, educationOptions, sectorOptions, hoursOptions }
}

/** Shared helper: build active filter chips. */
function buildActiveFilters(
  activeType?: string,
  activeHours?: string,
  activeEducation?: string,
  activeSector?: string,
  activeDistance?: string
) {
  const activeFilters: { paramName: string; value: string; label: string }[] = []
  if (activeType) {
    for (const v of activeType.split(',')) {
      activeFilters.push({ paramName: 'type', value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })
    }
  }
  if (activeHours) {
    for (const v of activeHours.split(',')) {
      activeFilters.push({ paramName: 'hours', value: v, label: HOURS_LABELS[v] || v })
    }
  }
  if (activeEducation) {
    for (const v of activeEducation.split(',')) {
      activeFilters.push({ paramName: 'education', value: v, label: v })
    }
  }
  if (activeSector) {
    for (const v of activeSector.split(',')) {
      activeFilters.push({ paramName: 'sector', value: v, label: v })
    }
  }
  if (activeDistance && activeDistance !== 'all') {
    activeFilters.push({ paramName: 'distance', value: activeDistance, label: `Binnen ${activeDistance} km` })
  }
  return activeFilters
}

/**
 * Standalone filter groups — reused by both desktop sidebar and mobile sheet.
 */
export function FilterGroups({
  facets,
  activeType,
  activeHours,
  activeEducation,
  activeSector,
  activeDistance,
}: FilterGroupsProps) {
  const { employmentOptions, educationOptions, sectorOptions, hoursOptions } = buildFilterOptions(facets)
  const activeTypeValues = activeType ? activeType.split(',') : []
  const activeEducationValues = activeEducation ? activeEducation.split(',') : []
  const activeSectorValues = activeSector ? activeSector.split(',') : []
  const activeHoursValues = activeHours ? activeHours.split(',') : []
  const activeDistanceValues = activeDistance ? [activeDistance] : []
  const activeFilters = buildActiveFilters(activeType, activeHours, activeEducation, activeSector, activeDistance)

  return (
    <>
      <ActiveFilters filters={activeFilters} />

      <FilterGroup
        title="Afstand"
        paramName="distance"
        type="radio"
        options={DISTANCE_OPTIONS}
        activeValues={activeDistanceValues}
      />

      {employmentOptions.length > 0 && (
        <FilterGroup
          title="Dienstverband"
          paramName="type"
          options={employmentOptions}
          activeValues={activeTypeValues}
        />
      )}

      {hoursOptions.length > 0 && (
        <FilterGroup
          title="Uren per week"
          paramName="hours"
          options={hoursOptions}
          activeValues={activeHoursValues}
        />
      )}

      {educationOptions.length > 0 && (
        <FilterGroup
          title="Opleidingsniveau"
          paramName="education"
          options={educationOptions}
          activeValues={activeEducationValues}
        />
      )}

      {sectorOptions.length > 0 && (
        <FilterGroup
          title="Sector"
          paramName="sector"
          options={sectorOptions}
          activeValues={activeSectorValues}
        />
      )}
    </>
  )
}

/**
 * Desktop filter sidebar — wraps FilterGroups with brand + footer chrome.
 */
export function FilterSidebar({
  tenant,
  facets,
  activeType,
  activeHours,
  activeEducation,
  activeSector,
  activeDistance,
  totalJobs,
}: FilterSidebarProps) {
  return (
    <aside
      className="hidden lg:block sticky top-16 overflow-y-auto"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-sm)',
        maxHeight: 'calc(100vh - 5rem)',
      }}
    >
      {/* Sidebar brand */}
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: '18px 16px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-tint)',
        }}
      >
        {tenant.logo_url ? (
          <Image
            src={tenant.logo_url}
            alt={tenant.name}
            width={200}
            height={28}
            className="h-7 w-auto object-contain"
          />
        ) : (
          <>
            <div
              className="shrink-0 grid place-items-center font-bold"
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: 'var(--primary)',
                color: 'var(--primary-ink)',
                fontSize: '0.75rem',
                letterSpacing: '-0.02em',
              }}
            >
              {(tenant.name || 'LB').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: '0.875rem', lineHeight: 1.2 }}>
                {tenant.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {tenant.central_place || 'Regio'}
              </div>
            </div>
          </>
        )}
      </div>

      <FilterGroups
        facets={facets}
        activeType={activeType}
        activeHours={activeHours}
        activeEducation={activeEducation}
        activeSector={activeSector}
        activeDistance={activeDistance}
      />

      {/* Sidebar footer */}
      <div
        style={{
          padding: '12px 16px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-tint)',
        }}
      >
        <p
          className="font-mono text-center"
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
        >
          {totalJobs.toLocaleString('nl-NL')} vacatures in de regio
        </p>
      </div>
    </aside>
  )
}
