import type { FilterFacets } from '@/lib/queries'
import { FilterGroup } from './filter-group'

export interface FilterPanelProps {
  facets: FilterFacets
  /** Comma-separated active values uit URL. */
  activeType?: string
  activeHours?: string
  activeEducation?: string
  activeSector?: string
  /** Header weglaten - bv. in mobile drawer waar de drawer-head al "Filters" toont. */
  hideHeading?: boolean
}

const HOURS_LABELS: Record<string, string> = {
  lt32:    'Parttime < 32 uur',
  '32-40': 'Fulltime 36 - 40 uur',
  gt40:    'Meer dan 40 uur',
}

/**
 * Filter-paneel per Eyeron-spec - 344px breed sidebar op desktop.
 * Componeert 4 FilterGroups: Afstand (radio) + Dienstverband, Vakgebied,
 * Aantal uur per week (allemaal checkbox).
 *
 * Server-component die alleen client-componenten (FilterGroup) inschakelt
 * voor de interactiviteit. Geen "use client" hier zelf nodig.
 */
export function FilterPanel({
  facets,
  activeType,
  activeHours,
  activeEducation: _activeEducation,
  activeSector,
  hideHeading,
}: FilterPanelProps) {
  // URL-strings → arrays voor checkbox-groepen
  const typeValues = activeType ? activeType.split(',') : []
  const hoursValues = activeHours ? activeHours.split(',') : []
  const sectorValues = activeSector ? activeSector.split(',') : []

  return (
    <aside className="bg-surface w-full px-[30px] pt-7 pb-[30px]" aria-label="Filters">
      {!hideHeading && (
        <h2 className="text-h1 font-bold text-primary tracking-tight mb-3.5 m-0">
          Filters
        </h2>
      )}

      <FilterGroup
        label="Dienstverband"
        paramName="type"
        type="checkbox"
        options={facets.employment.map((f) => ({
          value: f.value,
          label: f.value,
          count: f.count,
        }))}
        activeValues={typeValues}
      />

      <FilterGroup
        label="Vakgebied"
        paramName="sector"
        type="checkbox"
        options={facets.sector.map((f) => ({
          value: f.value,
          label: f.value,
          count: f.count,
        }))}
        activeValues={sectorValues}
      />

      <FilterGroup
        label="Aantal uur per week"
        paramName="hours"
        type="checkbox"
        options={facets.hours.map((f) => ({
          value: f.value,
          label: HOURS_LABELS[f.value] || f.value,
          count: f.count,
        }))}
        activeValues={hoursValues}
      />
    </aside>
  )
}
