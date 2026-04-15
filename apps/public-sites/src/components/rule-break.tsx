interface RuleBreakProps {
  /** Optional section marker label (uppercase). Rendered with a diamond glyph. */
  label?: string | null
  className?: string
}

/**
 * Editorial section marker — a horizontal ink rule with an optional uppercase
 * label on the left (e.g. "◇ Wijken & dorpen"). When no label is provided,
 * renders just the rule.
 *
 * Visually this is the full-width separator from the prototype's `.rule-break`.
 */
export function RuleBreak({ label, className }: RuleBreakProps) {
  return (
    <div
      className={['relative mx-auto my-6', className].filter(Boolean).join(' ')}
      style={{ maxWidth: 'var(--max)', padding: '0 var(--pad)' }}
      role="separator"
      aria-label={label || undefined}
    >
      <div
        aria-hidden="true"
        style={{ height: 1, background: 'var(--border-ink)' }}
      />
      {label && (
        <span
          className="absolute text-[0.6875rem] font-semibold uppercase tracking-[0.08em]"
          style={{
            left: 'var(--pad)',
            top: '-6px',
            background: 'var(--bg)',
            paddingRight: '14px',
            color: 'var(--text-2)',
          }}
        >
          ◇ {label}
        </span>
      )}
    </div>
  )
}
