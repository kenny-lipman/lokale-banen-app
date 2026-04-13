import Link from 'next/link'
import { MapPin } from 'lucide-react'

export interface CityLink {
  city: string
  slug: string
  count: number
}

interface NearbyCitiesProps {
  cities: CityLink[]
  title?: string
}

/**
 * Grid of city links with job counts.
 * Used on city pages for cross-linking and empty states.
 */
export function NearbyCities({ cities, title = 'Meer steden' }: NearbyCitiesProps) {
  if (cities.length === 0) return null

  return (
    <section className="mt-8">
      <h2 className="text-h2 text-foreground mb-4">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cities.map(({ city, slug, count }) => (
          <Link
            key={slug}
            href={`/vacatures/${slug}`}
            className="group flex items-center gap-2 rounded-lg p-3 transition-colors hover:bg-card-hover"
            style={{ border: '1px solid var(--border)' }}
          >
            <MapPin
              className="h-4 w-4 text-muted shrink-0 group-hover:text-primary transition-colors"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-body-medium text-foreground truncate group-hover:text-primary transition-colors">
                {city}
              </p>
              <p className="text-meta text-muted">
                {count} vacature{count !== 1 ? 's' : ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
