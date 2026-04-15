interface ContextStripProps {
  /** Region name — e.g. "Achterhoek". Leading text "Vacatures in de" is optional. */
  region?: string | null
  /** Optional leading copy; defaults to "Vacatures in de". */
  lead?: string
  /** Highlighted emphasis that gets italic + primary-dark styling. */
  emphasis?: string | null
  /** Total job count for this context — rendered as pill count. */
  jobCount?: number | null
  /** Relative update indicator — e.g. "Bijgewerkt 3 min geleden" */
  updatedLabel?: string | null
  /** Optional sub-label — "12 nieuw vandaag" */
  subLabel?: string | null
}

/**
 * Context strip — the "not-a-hero" fold-1 element.
 *
 * Compact two-line introducer that orients the visitor:
 *   Line 1 (left):  "Vacatures in de <Achterhoek>" + "247 open posities" pill
 *   Line 1 (right): "● Bijgewerkt 3 min geleden · 12 nieuw vandaag"
 *
 * Gracefully degrades when parts of the data are missing — if no region is
 * provided we return `null`. Update-label / sub-label are independently
 * optional. Count pill hidden when `jobCount` is null.
 */
export function ContextStrip({
  region,
  lead = 'Vacatures in',
  emphasis,
  jobCount,
  updatedLabel,
  subLabel,
}: ContextStripProps) {
  if (!region) return null

  const countLabel =
    jobCount != null && jobCount >= 0
      ? `${jobCount.toLocaleString('nl-NL')} ${jobCount === 1 ? 'open positie' : 'open posities'}`
      : null

  return (
    <section
      className="mx-auto flex flex-wrap items-baseline justify-between gap-6"
      style={{
        maxWidth: 'var(--max)',
        padding: '20px var(--pad) 12px',
      }}
      aria-label="Regio context"
    >
      <div className="flex flex-wrap items-baseline gap-[14px]">
        <h1
          className="text-foreground"
          style={{
            fontFamily: 'var(--font-display-stack)',
            fontWeight: 500,
            fontSize: 'clamp(1.5rem, 2.4vw, 1.9rem)',
            letterSpacing: '-0.015em',
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {lead}{' '}
          {emphasis ? (
            <em
              style={{
                fontStyle: 'italic',
                color: 'var(--primary-dark)',
                fontWeight: 500,
              }}
            >
              {emphasis}
            </em>
          ) : (
            <em
              style={{
                fontStyle: 'italic',
                color: 'var(--primary-dark)',
                fontWeight: 500,
              }}
            >
              {region}
            </em>
          )}
        </h1>
        {countLabel && (
          <span
            className="font-mono"
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-muted)',
              padding: '3px 9px',
              border: '1px solid var(--border)',
              borderRadius: 100,
              background: 'var(--surface)',
              letterSpacing: 0,
            }}
          >
            {countLabel}
          </span>
        )}
      </div>

      {(updatedLabel || subLabel) && (
        <div
          className="flex items-center gap-3"
          style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}
        >
          {updatedLabel && (
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: 'var(--success)',
                animation: 'lb-pulse 2.4s ease-in-out infinite',
              }}
            />
          )}
          <span>
            {updatedLabel}
            {updatedLabel && subLabel ? ' · ' : ''}
            {subLabel}
          </span>
        </div>
      )}

      <style>{`@keyframes lb-pulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.4; transform: scale(1.3);} }`}</style>
    </section>
  )
}
