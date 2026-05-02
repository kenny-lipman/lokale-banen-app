import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchBannerProps {
  /** Regio-naam in de h1 — wordt accent-gekleurd (secondary). */
  region: string
  /** Aantal open vacatures voor de pill rechtsboven. */
  jobCount?: number | null
  /** Pre-fill de input met deze waarde. */
  defaultQuery?: string
  /** Form action — default `/`. */
  formAction?: string
  className?: string
}

/**
 * Donker primary-banner met h1 + "X open posities"-pill + zoek-input.
 * Submitted naar `formAction` met `?q=...` query — server-side filtert
 * de homepage hierop. Geen client-side state nodig.
 */
export function SearchBanner({
  region,
  jobCount,
  defaultQuery,
  formAction = '/',
  className,
}: SearchBannerProps) {
  return (
    <section
      className={cn(
        'bg-primary px-5 sm:px-10 pt-6 pb-7 sm:pt-7 sm:pb-8',
        className
      )}
      aria-labelledby="search-title"
    >
      <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-5">
        <h1
          id="search-title"
          className="text-h1 font-regular text-on-dark leading-tight"
        >
          Zoek vacature in <em className="not-italic text-secondary">{region}</em>
        </h1>
        {typeof jobCount === 'number' && jobCount > 0 && (
          <span className="self-start inline-flex items-center h-9 px-4 rounded-pill border border-on-dark text-on-dark text-body whitespace-nowrap">
            {jobCount.toLocaleString('nl-NL')} open posities
          </span>
        )}
      </div>

      <form action={formAction} method="GET" role="search" className="relative h-[51px]">
        <label htmlFor="q" className="sr-only">
          Zoek op functie, bedrijf of plaats
        </label>
        <input
          id="q"
          name="q"
          type="search"
          autoComplete="off"
          defaultValue={defaultQuery}
          placeholder="Zoek op functie, bedrijf of plaats"
          className="w-full h-[51px] pl-6 pr-16 rounded-input bg-surface text-input text-primary placeholder:text-placeholder outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--secondary)_40%,transparent)]"
        />
        <button
          type="submit"
          aria-label="Zoeken"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-[39px] h-[39px] rounded-full bg-secondary text-secondary-ink inline-flex items-center justify-center hover:bg-secondary-hover active:bg-secondary-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-dark transition-colors"
        >
          <Search className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </section>
  )
}
