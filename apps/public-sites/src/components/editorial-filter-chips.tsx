import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterChipItem {
  /** Stable identifier for the chip. */
  id: string
  /** Visible label. */
  label: string
  /** Optional count shown after the label in monospace. */
  count?: number | null
  /** Active/selected state. Active chips get primary-tint + X-dismiss. */
  isActive?: boolean
  /** Optional secondary "dot" indicator (e.g. for group markers). */
  dotColor?: string | null
  /** URL to navigate to when chip is clicked or dismissed (via href). */
  href?: string
  /** When set, renders an X button pointing to this href (the "dismiss" URL). */
  dismissHref?: string
}

interface EditorialFilterChipsProps {
  items: FilterChipItem[]
  /** Optional trailing "+ Filter" affordance. */
  onAddFilterHref?: string
  className?: string
  /** aria-label for the scroller. Defaults to "Snelfilters". */
  ariaLabel?: string
}

/**
 * Horizontal scrollable filter-chip row in the editorial style.
 *
 * Active chips use `--primary-tint` background and `--primary` border + dark
 * ink; inactive chips are flat on the surface with a subtle border. Optional
 * X-dismiss link per chip lets users remove a filter without JS.
 *
 * Server-renderable: uses Next.js `<Link>` for both chip activation and
 * dismissal. No client state.
 */
export function EditorialFilterChips({
  items,
  onAddFilterHref,
  className,
  ariaLabel = 'Snelfilters',
}: EditorialFilterChipsProps) {
  if (items.length === 0 && !onAddFilterHref) return null

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        'mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none',
        className
      )}
      style={{
        maxWidth: 'var(--max)',
        padding: '0 var(--pad) 16px',
        scrollSnapType: 'x proximity',
      }}
    >
      {items.map((chip) => {
        const inner = (
          <>
            {chip.dotColor && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: chip.dotColor }}
              />
            )}
            <span>{chip.label}</span>
            {chip.count != null && (
              <span
                className="font-mono"
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  padding: '0 4px',
                }}
              >
                {chip.count.toLocaleString('nl-NL')}
              </span>
            )}
            {chip.isActive && chip.dismissHref && (
              <Link
                href={chip.dismissHref}
                aria-label={`Filter ${chip.label} verwijderen`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center opacity-80 hover:opacity-100"
                style={{ marginLeft: 2 }}
              >
                <X size={11} strokeWidth={2.5} aria-hidden="true" />
              </Link>
            )}
          </>
        )

        const chipClassName = cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full transition-colors',
          'scroll-snap-align-start font-medium'
        )
        const baseStyle: React.CSSProperties = {
          padding: '7px 14px 7px 12px',
          fontSize: '0.8125rem',
          border: '1px solid',
          borderColor: chip.isActive ? 'var(--primary)' : 'var(--border)',
          background: chip.isActive ? 'var(--primary-tint)' : 'var(--surface)',
          color: chip.isActive ? 'var(--primary-dark)' : 'var(--text-2)',
        }

        if (chip.href) {
          return (
            <Link
              key={chip.id}
              href={chip.href}
              className={chipClassName}
              style={baseStyle}
              aria-pressed={chip.isActive || undefined}
            >
              {inner}
            </Link>
          )
        }

        return (
          <span key={chip.id} className={chipClassName} style={baseStyle}>
            {inner}
          </span>
        )
      })}

      {onAddFilterHref && (
        <Link
          href={onAddFilterHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full"
          style={{
            padding: '7px 14px 7px 12px',
            fontSize: '0.8125rem',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--primary-dark)',
            fontWeight: 500,
          }}
        >
          + Filter
        </Link>
      )}
    </nav>
  )
}
