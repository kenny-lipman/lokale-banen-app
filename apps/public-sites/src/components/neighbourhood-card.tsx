import Link from 'next/link'

interface NeighbourhoodCardProps {
  /** Postcode / 4-digit prefix — e.g. "7001". */
  postcode?: string | null
  /** Neighbourhood/village name. */
  name: string
  /** Count of vacatures in this neighbourhood. */
  count?: number | null
  /** Link target. */
  href: string
}

/**
 * Neighbourhood card — horizontal-scrolling tile used in the city-landing
 * "Wijken & dorpen" strip.
 *
 * Compact paper card (200px wide) with monospaced postcode, Newsreader
 * neighbourhood name, and primary-dark count. Returns `null` without a name.
 */
export function NeighbourhoodCard({
  postcode,
  name,
  count,
  href,
}: NeighbourhoodCardProps) {
  if (!name) return null

  return (
    <Link
      href={href}
      className="shrink-0 transition-colors"
      style={{
        width: 200,
        padding: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {postcode && (
        <div
          style={{
            fontFamily: 'var(--font-mono-stack)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          {postcode}
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-display-stack)',
          fontWeight: 500,
          fontSize: '1.05rem',
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
          marginBottom: 6,
          color: 'var(--text)',
        }}
      >
        {name}
      </div>
      {count != null && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--primary-dark)',
          }}
        >
          {count.toLocaleString('nl-NL')} vacatures →
        </div>
      )}
    </Link>
  )
}
