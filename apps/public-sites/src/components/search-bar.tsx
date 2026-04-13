import { Search, MapPin } from 'lucide-react'

interface SearchBarProps {
  defaultQuery?: string
  defaultLocation?: string
  tenantRegion?: string | null
}

/**
 * Search bar with function + location inputs.
 * Submits as a GET form to keep state in URL searchParams.
 * Warm muted background, no border — focus ring only.
 */
export function SearchBar({
  defaultQuery = '',
  defaultLocation = '',
  tenantRegion,
}: SearchBarProps) {
  return (
    <form action="/" method="GET" className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Functie, bedrijf of trefwoord"
            defaultValue={defaultQuery}
            className="flex h-10 w-full rounded-lg bg-muted px-3 py-2 pl-9 text-body text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label="Zoek op functie of trefwoord"
          />
        </div>
        <div className="relative sm:w-44">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            name="location"
            placeholder={tenantRegion || 'Locatie'}
            defaultValue={defaultLocation}
            className="flex h-10 w-full rounded-lg bg-muted px-3 py-2 pl-9 text-body text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            aria-label="Zoek op locatie"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-body font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto w-full"
        >
          Zoeken
        </button>
      </div>
    </form>
  )
}
