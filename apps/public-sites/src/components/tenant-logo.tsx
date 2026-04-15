import Image from 'next/image'

interface TenantLogoProps {
  /** URL to the tenant's SVG/PNG logo — e.g. from `platforms.logo_url`. */
  src?: string | null
  /** Region/tenant name — used for alt text and initial fallback. */
  name: string
  /** Maximum rendered height (px). Defaults to 40. */
  maxHeight?: number
  className?: string
  /** When provided, rendered as subtitle below the logo. */
  tagline?: string | null
}

/**
 * Tenant logo with automatic initial-fallback.
 *
 * When `src` is available, renders an actual image respecting its aspect
 * ratio (width auto, height clamped to `maxHeight`). When `src` is null,
 * renders a rounded primary-colored tile with the tenant's initials in the
 * body font — matching the prototype's `.brand-mark`.
 *
 * Optionally shows a tagline beneath. Returns null only when `name` is falsy
 * (which should never happen since tenant always has a name).
 */
export function TenantLogo({
  src,
  name,
  maxHeight = 40,
  className,
  tagline,
}: TenantLogoProps) {
  if (!name) return null

  // Strip "Banen" to keep the initial set small: "AchterhoekseBanen" -> "AB"
  const initials = deriveTenantInitials(name)

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {src ? (
        <Image
          src={src}
          alt={`${name} logo`}
          width={200}
          height={maxHeight}
          className="w-auto object-contain"
          style={{ maxHeight, width: 'auto' }}
          priority
          unoptimized
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--primary)',
            color: 'var(--primary-ink)',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontFamily: 'var(--font-body-stack)',
            fontSize: '0.875rem',
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
      )}
      {(tagline || !src) && (
        <div>
          {!src && (
            <div
              style={{
                fontFamily: 'var(--font-display-stack)',
                fontWeight: 500,
                fontSize: '1.05rem',
                lineHeight: 1,
                letterSpacing: '-0.008em',
              }}
            >
              {name}
            </div>
          )}
          {tagline && (
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-body-stack)',
                marginTop: 2,
                display: 'block',
                letterSpacing: 0,
              }}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function deriveTenantInitials(name: string): string {
  // "AchterhoekseBanen" -> "AB"  (CamelCase boundaries)
  // "Lokale Banen" -> "LB" (space split)
  const camelMatch = name.match(/[A-Z]/g)
  if (camelMatch && camelMatch.length >= 2) {
    return camelMatch.slice(0, 2).join('')
  }

  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }

  return name.slice(0, 2).toUpperCase()
}
