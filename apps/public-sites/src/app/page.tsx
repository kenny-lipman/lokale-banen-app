import { getTenant } from '@/lib/tenant'
import { getJobBySlug } from '@/lib/queries'
import { TenantHeader } from '@/components/tenant-header'
import { FilterChips } from '@/components/filter-chips'
import { JobList } from '@/components/job-list'
import { JobDetailPanel, EmptyDetailState } from '@/components/job-detail-panel'
import type { JobFilter } from '@/lib/queries'
import Link from 'next/link'

interface HomePageProps {
  searchParams: Promise<{
    q?: string
    location?: string
    type?: string
    page?: string
    selected?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const tenant = await getTenant()

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-display mb-2">Domein niet gevonden</h1>
          <p className="text-body text-muted-foreground">
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

  // Fetch selected job for split-view detail panel (desktop)
  const selectedSlug = params.selected || null
  const selectedJob = selectedSlug
    ? await getJobBySlug(tenant.id, selectedSlug)
    : null

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader
        tenant={tenant}
        defaultQuery={params.q}
        defaultLocation={params.location}
      />

      {/* Filter chips bar */}
      <div className="border-b border-border bg-white">
        <div className="container py-2">
          <FilterChips
            activeType={params.type || 'alle'}
            baseParams={baseParams}
          />
        </div>
      </div>

      {/* Main content: split-view on desktop, list-only on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: job list */}
        <div className="w-full lg:w-[380px] lg:shrink-0 lg:border-r border-border lg:overflow-y-auto lg:split-list bg-white">
          <JobList
            tenantId={tenant.id}
            filter={filter}
            selectedSlug={selectedSlug}
          />
        </div>

        {/* Right: detail panel (desktop only) */}
        <div className="hidden lg:block flex-1 overflow-y-auto split-detail bg-white">
          {selectedJob ? (
            <JobDetailPanel job={selectedJob} />
          ) : (
            <EmptyDetailState />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="container py-6 sm:py-8">
          {/* SEO internal links */}
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div>
              <h3 className="font-semibold text-meta text-foreground mb-2">
                Vacatures per plaats
              </h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
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
              <div className="flex flex-wrap gap-x-3 gap-y-1">
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
              &copy; {new Date().getFullYear()} {tenant.name}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
