import { getTenant } from '@/lib/tenant'
import { getJobBySlug } from '@/lib/queries'
import { TenantHeader } from '@/components/tenant-header'
import { FilterBar } from '@/components/filter-bar'
import { JobList } from '@/components/job-list'
import { JobDetailPanel, EmptyDetailState } from '@/components/job-detail-panel'
import { Footer } from '@/components/footer'
import type { JobFilter, SortOption } from '@/lib/queries'

interface HomePageProps {
  searchParams: Promise<{
    q?: string
    location?: string
    type?: string
    page?: string
    selected?: string
    sort?: string
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

  const sortParam = (params.sort || 'newest') as SortOption
  const filter: JobFilter = {
    query: params.q,
    location: params.location,
    type: params.type,
    page: params.page ? parseInt(params.page, 10) : 1,
    sort: sortParam,
  }

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

      <FilterBar
        filters={{
          query: params.q,
          location: params.location,
          type: params.type,
        }}
        tenant={tenant}
      />

      {/* Split view container */}
      <div className="flex-1 flex" style={{ height: 'calc(100vh - 108px)' }}>
        {/* Left: job list panel (desktop) */}
        <div className="hidden lg:block w-[420px] xl:w-[440px] flex-shrink-0 overflow-y-auto scrollbar-thin bg-surface" style={{ overscrollBehavior: 'contain', borderRight: '1px solid var(--border)' }}>
          <JobList
            tenantId={tenant.id}
            filter={filter}
            selectedSlug={selectedSlug}
          />
        </div>

        {/* Mobile: full-width list */}
        <div className="lg:hidden flex-1 overflow-y-auto bg-surface">
          <JobList
            tenantId={tenant.id}
            filter={filter}
            selectedSlug={selectedSlug}
          />
        </div>

        {/* Right: detail panel (desktop only) */}
        <div className="hidden lg:block flex-1 overflow-y-auto scrollbar-thin bg-surface" style={{ overscrollBehavior: 'contain' }}>
          {selectedJob ? (
            <JobDetailPanel job={selectedJob} tenantName={tenant.name} tenantDomain={tenant.domain || undefined} />
          ) : (
            <EmptyDetailState />
          )}
        </div>
      </div>

      {/* Footer: only visible on mobile (desktop is full-height split-view) */}
      <Footer tenant={tenant} hiddenOnDesktop />
    </div>
  )
}
