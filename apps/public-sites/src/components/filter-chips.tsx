import Link from 'next/link'
import { cn } from '@/lib/utils'

const FILTERS = [
  { label: 'Alle', value: 'alle' },
  { label: 'Fulltime', value: 'fulltime' },
  { label: 'Parttime', value: 'parttime' },
  { label: 'Stage', value: 'stage' },
  { label: 'Thuiswerk', value: 'thuiswerk' },
] as const

interface FilterChipsProps {
  activeType: string
  baseParams?: Record<string, string>
}

/**
 * Horizontal scrollable filter chips for employment type.
 * Each chip is a Link that updates the URL searchParams.
 * No JS state -- server re-renders with new filter.
 */
export function FilterChips({ activeType, baseParams = {} }: FilterChipsProps) {
  return (
    <nav
      aria-label="Filter op dienstverband"
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1"
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
              'inline-flex items-center whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors',
              'min-h-[36px] min-w-[44px] justify-center',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
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
