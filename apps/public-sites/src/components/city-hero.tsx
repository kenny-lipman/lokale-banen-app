interface CityStat {
  /** Stat value — e.g. "247" or "€3.100". */
  value: string
  /** Uppercase label under the value. */
  label: string
}

interface CityHeroProps {
  /** Eyebrow label above the hero — e.g. "Vacatures in" or "Regio Achterhoek". */
  eyebrow?: string | null
  /** City name — rendered in the mega display serif. */
  name: string
  /** Italic accent — e.g. "Achterhoek" after the city name. */
  accent?: string | null
  /** Short paragraph describing the city. */
  description?: string | null
  /** Up to 3 stats shown on the right. */
  stats?: CityStat[]
}

/**
 * City hero — the editorial landing element for city pages.
 *
 * Massive serif name with italic accent, optional description, and up to
 * three stat pillars on the right. Gracefully collapses to a single-column
 * on mobile. Without `name` the whole hero returns `null`.
 */
export function CityHero({
  eyebrow,
  name,
  accent,
  description,
  stats = [],
}: CityHeroProps) {
  if (!name) return null

  const validStats = stats.filter((s) => s.value && s.label)

  return (
    <section
      className="mx-auto grid items-end gap-10 md:grid-cols-[1fr_auto] grid-cols-1"
      style={{
        maxWidth: 'var(--max)',
        padding: '32px var(--pad) 20px',
      }}
    >
      <div>
        {eyebrow && (
          <div
            className="flex items-center gap-2.5"
            style={{
              marginBottom: 10,
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 24, height: 1, background: 'var(--text-muted)' }}
            />
            {eyebrow}
          </div>
        )}
        <h1
          style={{
            fontFamily: 'var(--font-display-stack)',
            fontWeight: 500,
            fontSize: 'clamp(3rem, 7.5vw, 6.25rem)',
            lineHeight: 0.92,
            letterSpacing: '-0.028em',
            color: 'var(--text)',
            marginBottom: 14,
          }}
        >
          {name}
          {accent && (
            <>
              {' '}
              <span
                style={{
                  fontStyle: 'italic',
                  color: 'var(--primary-dark)',
                  fontWeight: 500,
                }}
              >
                {accent}
              </span>
            </>
          )}
        </h1>
        {description && (
          <p
            style={{
              maxWidth: '48ch',
              fontSize: '1rem',
              lineHeight: 1.55,
              color: 'var(--text-2)',
            }}
          >
            {description}
          </p>
        )}
      </div>

      {validStats.length > 0 && (
        <div
          className="grid gap-7"
          style={{
            gridTemplateColumns: `repeat(${validStats.length}, auto)`,
            padding: '0 4px 4px',
          }}
        >
          {validStats.map((s, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontFamily: 'var(--font-display-stack)',
                  fontSize: '2.25rem',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  lineHeight: 1,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--text-muted)',
                  marginTop: 6,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
