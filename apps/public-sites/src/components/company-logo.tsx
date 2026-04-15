import Image from 'next/image'

interface CompanyLogoProps {
  /** Company logo URL — if null, falls back to initial-based placeholder. */
  src?: string | null
  /** Company name — used for alt text and initial fallback. */
  name: string
  /** Size variant — list card (44px) or detail hero (52px). */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Company logo with initial-fallback placeholder.
 *
 * Renders an actual image when `src` is provided, otherwise a paper-tinted
 * rounded square with the company's initials (2 chars max) in the editorial
 * display serif. This matches the prototype's `.company-logo` style.
 */
export function CompanyLogo({
  src,
  name,
  size = 'sm',
  className,
}: CompanyLogoProps) {
  const px = size === 'md' ? 52 : 44
  const fontSize = size === 'md' ? '1.35rem' : '1.1rem'
  const initials = deriveInitials(name)

  const common = {
    width: px,
    height: px,
    borderRadius: size === 'md' ? 10 : 8,
    border: '1px solid var(--border)',
  } as const

  if (src) {
    return (
      <div
        aria-hidden={false}
        className={className}
        style={{
          ...common,
          background: 'var(--surface)',
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Image
          src={src}
          alt={`${name} logo`}
          width={px}
          height={px}
          className="h-full w-full object-contain"
          unoptimized
        />
      </div>
    )
  }

  return (
    <div
      className={className}
      aria-label={`${name} logo`}
      style={{
        ...common,
        background: 'var(--bg-tint)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'var(--font-display-stack)',
        fontWeight: 500,
        color: 'var(--text-2)',
        fontSize,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

function deriveInitials(name: string): string {
  const cleaned = name.trim()
  if (!cleaned) return '·'

  // Split on whitespace / common punctuation; pick first chars of first 2 tokens.
  const parts = cleaned
    .split(/[\s\-_./·]+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) return cleaned.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return (parts[0][0] + parts[1][0]).toUpperCase()
}
