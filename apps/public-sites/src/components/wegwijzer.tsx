import Link from 'next/link'
import { ArrowLeft, MapPin, Clock } from 'lucide-react'

export interface WegwijzerItem {
  /** Unique key. */
  id: string
  /** Content to render (plain text or ReactNode). */
  label: React.ReactNode
  /** Optional icon — defaults to no icon. */
  icon?: 'map' | 'clock' | 'none'
  /** Monospaced distance-style item — keeps text case and uses mono font. */
  mono?: boolean
  /** Optional href — renders as <Link>. */
  href?: string
}

interface WegwijzerProps {
  /** Back link — renders first with left arrow + primary-dark color. */
  back?: { label: string; href: string }
  /** Ordered breadcrumb-style items. */
  items?: WegwijzerItem[]
}

/**
 * Wegwijzer — editorial breadcrumb strip for detail pages.
 *
 * Signature component: horizontal row with back-arrow, then position markers
 * (city, distance, updated-time) separated by 1px vertical rules. Mono items
 * (distance) keep their case and use JetBrains Mono.
 *
 * Returns `null` when both `back` and `items` are empty.
 */
export function Wegwijzer({ back, items = [] }: WegwijzerProps) {
  if (!back && items.length === 0) return null

  return (
    <div
      role="navigation"
      aria-label="Wegwijzer"
      className="flex items-center overflow-x-auto scrollbar-none whitespace-nowrap"
      style={{
        gap: 0,
        padding: '12px 24px',
        background: 'var(--bg-tint)',
        borderBottom: '1px solid var(--border)',
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--text-2)',
      }}
    >
      {back && (
        <Link
          href={back.href}
          className="inline-flex shrink-0 items-center gap-1.5"
          style={{
            padding: '0 14px 0 0',
            color: 'var(--primary-dark)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={13} strokeWidth={2} aria-hidden="true" />
          {back.label}
        </Link>
      )}

      {items.map((item, idx) => {
        const isFirst = idx === 0 && !back
        const icon =
          item.icon === 'map' ? (
            <MapPin size={12} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          ) : item.icon === 'clock' ? (
            <Clock size={11} strokeWidth={2.5} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          ) : null

        const inner = (
          <>
            {icon}
            <span
              style={{
                fontFamily: item.mono ? 'var(--font-mono-stack)' : undefined,
                letterSpacing: item.mono ? 0 : undefined,
                textTransform: item.mono ? 'none' : undefined,
                fontWeight: item.mono ? 500 : undefined,
              }}
            >
              {item.label}
            </span>
          </>
        )

        const itemStyle: React.CSSProperties = {
          padding: isFirst ? '0 14px 0 0' : '0 14px',
          position: 'relative',
          borderLeft:
            idx === 0 && !back ? 'none' : '1px solid var(--border-strong)',
        }

        if (item.href) {
          return (
            <Link
              key={item.id}
              href={item.href}
              className="inline-flex shrink-0 items-center gap-1.5"
              style={itemStyle}
            >
              {inner}
            </Link>
          )
        }

        return (
          <span
            key={item.id}
            className="inline-flex shrink-0 items-center gap-1.5"
            style={itemStyle}
          >
            {inner}
          </span>
        )
      })}
    </div>
  )
}
