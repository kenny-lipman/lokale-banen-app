import Link from 'next/link'
import { cn } from '@/lib/utils'

const FILTERS = [
  { label: 'Alle', value: 'alle' },
  { label: 'Fulltime', value: 'fulltime' },
  { label: 'Parttime', value: 'parttime' },
  { label: 'Tijdelijk', value: 'tijdelijk' },
  { label: 'Stage', value: 'stage' },
] as const

interface FilterChipsProps {
  activeType: string
  baseParams?: Record<string, string>
}

/**
 * Horizontal scrollable filter chips for employment type.
 * Each chip is a Link that updates the URL searchParams.
 * Small (h-8), compact. Active = filled primary. Inactive = transparent + border.
 */
export function FilterChips({ activeType, baseParams = {} }: FilterChipsProps) {
  return (
    <nav
      aria-label="Filter op dienstverband"
      className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 py-1"
    >
      {FILTERS.map((filter) => {
        const isActive =
          filter.value === activeType ||
          (filter.value === 'alle' && !activeType)

        // Build URL params preserving existing search query/location
        const params = new URLSearchParams(baseParams)
        if (filter.value === 'alle') {
          params.delete('type')
        } else {
          params.set('type', filter.value)
        }
        const href = params.toString() ? `/?${params.toString()}` : '/'

        return (
          <Link
            key={filter.value}
            href={href}
            className={cn(
              'inline-flex items-center whitespace-nowrap rounded-md px-3 h-8 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent border border-border text-foreground hover:bg-muted'
            )}
            aria-current={isActive ? 'true' : undefined}
          >
            {filter.label}
          </Link>
        )
      })}
    </nav>
  )
}
