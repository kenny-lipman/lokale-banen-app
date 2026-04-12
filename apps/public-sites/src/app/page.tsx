import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { FilterChips } from '@/components/filter-chips'
import { JobList } from '@/components/job-list'
import type { JobFilter } from '@/lib/queries'
import Link from 'next/link'

interface HomePageProps {
  searchParams: Promise<{
    q?: string
    location?: string
    type?: string
    page?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const tenant = await getTenant()

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-h1 font-bold mb-2">Domein niet gevonden</h1>
          <p className="text-muted-foreground">
            Dit domein is niet gekoppeld aan een platform.
          </p>
        </div>
      </div>
    )
  }

  const filter: JobFilter = {
    query: params.q,
    location: params.location,
    type: params.type,
    page: params.page ? parseInt(params.page, 10) : 1,
  }

  // Build base params for filter chips (preserve search query/location)
  const baseParams: Record<string, string> = {}
  if (params.q) baseParams.q = params.q
  if (params.location) baseParams.location = params.location

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader
        tenant={tenant}
        defaultQuery={params.q}
        defaultLocation={params.location}
      />

      <main className="flex-1 container py-4 sm:py-6">
        {/* Filter chips */}
        <div className="mb-4">
          <FilterChips
            activeType={params.type || 'alle'}
            baseParams={baseParams}
          />
        </div>

        {/* Job list with Suspense */}
        <JobList tenantId={tenant.id} filter={filter} />
      </main>

      {/* Footer with SEO links */}
      <footer className="border-t bg-muted/30">
        <div className="container py-8 sm:py-12">
          {/* SEO internal links */}
          <div className="grid gap-6 sm:grid-cols-2 mb-8">
            <div>
              <h3 className="font-semibold text-meta text-foreground mb-2">
                Vacatures per plaats
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Naaldwijk', 'Maasdijk', 'Wateringen', 'De Lier', "'s-Gravenzande"].map(
                  (city) => (
                    <Link
                      key={city}
                      href={`/?location=${encodeURIComponent(city)}`}
                      className="text-meta text-muted-foreground hover:text-primary transition-colors"
                    >
                      {city}
                    </Link>
                  )
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-meta text-foreground mb-2">
                Vacatures per sector
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Tuinbouw', 'Logistiek', 'Techniek', 'Zorg', 'Horeca'].map(
                  (sector) => (
                    <Link
                      key={sector}
                      href={`/?q=${encodeURIComponent(sector)}`}
                      className="text-meta text-muted-foreground hover:text-primary transition-colors"
                    >
                      {sector}
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Brand footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-4 border-t border-border/50">
            <p className="text-meta text-muted-foreground">
              Onderdeel van{' '}
              <a
                href="https://lokalebanen.nl"
                className="font-medium text-foreground hover:text-primary transition-colors"
              >
                Lokale Banen Netwerk
              </a>
            </p>
            <p className="text-meta text-muted-foreground">
              &copy; {new Date().getFullYear()} Lokale Banen
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
