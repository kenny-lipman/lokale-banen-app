import { Search, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  defaultQuery?: string
  defaultLocation?: string
  tenantRegion?: string | null
}

/**
 * Search bar with function + location inputs.
 * Submits as a GET form to keep state in URL searchParams.
 * No client-side JS needed -- pure HTML form submission.
 */
export function SearchBar({
  defaultQuery = '',
  defaultLocation = '',
  tenantRegion,
}: SearchBarProps) {
  return (
    <form action="/" method="GET" className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            placeholder="Functie of trefwoord"
            defaultValue={defaultQuery}
            className="pl-9 h-11"
            aria-label="Zoek op functie of trefwoord"
          />
        </div>
        <div className="relative sm:w-48">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            name="location"
            placeholder={tenantRegion || 'Locatie'}
            defaultValue={defaultLocation}
            className="pl-9 h-11"
            aria-label="Zoek op locatie"
          />
        </div>
        <Button type="submit" size="lg" className="h-11 sm:w-auto w-full">
          Zoeken
        </Button>
      </div>
    </form>
  )
}
