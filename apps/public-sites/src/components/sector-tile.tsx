import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface SectorTileProps {
  /** Sector/category display name — e.g. "Zorg & Welzijn". */
  name: string
  /** Short description line below the name. Optional. */
  description?: string | null
  /** Job count for this sector. When nullish, no count is rendered. */
  count?: number | null
  /** Link target. */
  href: string
}

/**
 * Sector tile — one of the editorial category cards on the city-landing.
 *
 * Flat paper tile that hovers into primary-tint. Count (bottom-right) is
 * monospaced and primary-dark. Description is conditional; when absent we
 * just show the name.
 */
export function SectorTile({
  name,
  description,
  count,
  href,
}: SectorTileProps) {
  if (!name) return null

  return (
    <Link
      href={href}
      className="group flex flex-col justify-between transition-colors"
      style={{
        padding: '18px 18px 22px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        minHeight: 112,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)'
        e.currentTarget.style.background = 'var(--primary-tint)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--surface)'
      }}
    >
      <div>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.9375rem',
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          {name}
        </div>
        {description && (
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        )}
      </div>
      {count != null && (
        <div
          className="self-end inline-flex items-center gap-1"
          style={{
            fontFamily: 'var(--font-mono-stack)',
            fontSize: '0.8125rem',
            color: 'var(--primary-dark)',
            marginTop: 12,
          }}
        >
          {count.toLocaleString('nl-NL')} vacatures
          <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
        </div>
      )}
    </Link>
  )
}
