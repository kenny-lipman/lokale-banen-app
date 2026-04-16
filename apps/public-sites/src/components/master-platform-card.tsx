import Link from 'next/link'
import type { PlatformSummary } from '@/lib/queries'

interface MasterPlatformCardProps {
  platform: PlatformSummary
}

/**
 * Regio-platform card for the master aggregator homepage grid.
 *
 * Shows: region name (Newsreader serif), central place, job count.
 * Links to the platform's preview_domain (or domain when live).
 */
export function MasterPlatformCard({ platform }: MasterPlatformCardProps) {
  // Prefer preview_domain for now (production domains not yet live)
  const host = platform.preview_domain ?? platform.domain
  const href = host ? `https://${host}` : '#'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '16px 18px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        textDecoration: 'none',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.borderColor = 'var(--primary)'
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement
        el.style.borderColor = 'var(--border)'
        el.style.boxShadow = 'none'
      }}
    >
      {/* Region name */}
      <div
        style={{
          fontFamily: 'var(--font-display-stack)',
          fontWeight: 500,
          fontSize: '1.0625rem',
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          color: 'var(--text)',
        }}
      >
        {platform.name}
      </div>

      {/* Central place */}
      {platform.central_place && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-muted)',
          }}
        >
          {platform.central_place}
        </div>
      )}

      {/* Job count */}
      <div
        style={{
          marginTop: 4,
          fontFamily: 'var(--font-mono-stack)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: 'var(--primary-dark)',
        }}
      >
        {platform.job_count > 0
          ? `${platform.job_count.toLocaleString('nl-NL')} vacatures →`
          : 'Binnenkort →'}
      </div>
    </a>
  )
}

/** Platform badge chip — used in master job feed to identify the owning region. */
interface PlatformBadgeProps {
  name: string
  /** Preview or production domain for linking to the region site. */
  host?: string | null
}

export function PlatformBadge({ name, host }: PlatformBadgeProps) {
  const content = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        fontSize: '0.6875rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        borderRadius: 100,
        background: 'var(--primary-light)',
        color: 'var(--primary-dark)',
        border: '1px solid var(--primary-muted)',
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  )

  if (!host) return content
  return (
    <a
      href={`https://${host}`}
      target="_blank"
      rel="noopener"
      style={{ textDecoration: 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </a>
  )
}
