import { cn } from '@/lib/utils'

interface PageHeroProps {
  /** Optionele eyebrow boven de h1. */
  eyebrow?: string
  /** Hoofdtitel - bv. "Vacatures in Doetinchem" of "Bedrijven". */
  title: string
  /** Optionele accent-substring binnen de title (in secondary kleur). */
  accent?: string
  /** Subtekst onder de h1. */
  description?: string
  className?: string
}

/**
 * Generieke page-hero - h1 + optionele eyebrow + description. Gebruikt op
 * list-routes als titel-blok onder de header (vóór de cards).
 *
 * Style is subtiel - geen primary-banner zoals SearchBanner. Tekst-only,
 * primary kleur, max-width voor leesbaarheid.
 */
export function PageHero({
  eyebrow,
  title,
  accent,
  description,
  className,
}: PageHeroProps) {
  return (
    <section className={cn('mb-s4', className)}>
      {eyebrow && (
        <p className="m-0 mb-2 text-small font-light tracking-[0.08em] uppercase text-muted">
          {eyebrow}
        </p>
      )}
      <h1 className="m-0 text-h1 font-bold tracking-tight text-primary leading-tight">
        {accent ? renderWithAccent(title, accent) : title}
      </h1>
      {description && (
        <p className="m-0 mt-3 text-lead font-regular text-primary max-w-prose">
          {description}
        </p>
      )}
    </section>
  )
}

/** Kleur de eerste voorkomen van `accent` in de title in secondary. */
function renderWithAccent(title: string, accent: string): React.ReactNode {
  const idx = title.indexOf(accent)
  if (idx === -1) return title
  return (
    <>
      {title.slice(0, idx)}
      <span className="text-secondary">{accent}</span>
      {title.slice(idx + accent.length)}
    </>
  )
}
