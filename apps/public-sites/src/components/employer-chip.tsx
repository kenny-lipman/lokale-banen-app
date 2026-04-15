import Link from 'next/link'
import { CompanyLogo } from './company-logo'

interface EmployerChipProps {
  /** Employer/company display name. */
  name: string
  /** Logo URL — falls back to initials. */
  logoUrl?: string | null
  /** Number of vacatures for this employer. */
  count?: number | null
  /** Link target — usually the company profile page. */
  href: string
}

/**
 * Employer chip — grid tile used in the "Grootste werkgevers" section
 * of the city-landing.
 *
 * Shows company logo (or initials-fallback) + company name + vacature count.
 * Hover tints to primary-tint for editorial feel.
 */
export function EmployerChip({
  name,
  logoUrl,
  count,
  href,
}: EmployerChipProps) {
  if (!name) return null

  return (
    <Link
      href={href}
      className="flex flex-col justify-between transition-colors"
      style={{
        padding: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        minHeight: 100,
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
        <div style={{ width: 32, height: 32, marginBottom: 12 }}>
          <CompanyLogo src={logoUrl} name={name} size="sm" />
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.875rem',
            color: 'var(--text)',
            lineHeight: 1.3,
          }}
        >
          {name}
        </div>
      </div>
      {count != null && (
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--primary-dark)',
            marginTop: 8,
          }}
        >
          {count.toLocaleString('nl-NL')} {count === 1 ? 'vacature' : 'vacatures'}
        </div>
      )}
    </Link>
  )
}
