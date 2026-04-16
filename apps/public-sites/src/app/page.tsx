import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug, getJobCount } from '@/lib/queries'
import { TenantHeader } from '@/components/tenant-header'
import { FilterBar } from '@/components/filter-bar'
import { ContextStrip } from '@/components/context-strip'
import { JobList } from '@/components/job-list'
import { JobDetailPanel, EmptyDetailState } from '@/components/job-detail-panel'
import { Footer } from '@/components/footer'
import type { JobFilter, SortOption } from '@/lib/queries'

const VALID_SORTS = ['newest', 'salary_desc', 'oldest'] as const
type ValidSort = typeof VALID_SORTS[number]

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  if (!tenant) return { title: 'Lokale Banen' }

  return {
    title: tenant.hero_title || `Vacatures in ${tenant.central_place}`,
    description: tenant.seo_description || `Vind lokale vacatures bij ${tenant.name}`,
    alternates: {
      canonical: tenant.domain ? `https://${tenant.domain}` : undefined,
    },
  }
}

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

  const sort: SortOption = VALID_SORTS.includes(params.sort as ValidSort)
    ? (params.sort as SortOption)
    : 'newest'
  const pageNum = parseInt(params.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const filter: JobFilter = {
    query: params.q,
    location: params.location,
    type: params.type,
    page,
    sort,
  }

  // Parallel fetch: selected job for split-view + total count for context strip
  const selectedSlug = params.selected || null
  const [selectedJob, totalJobCount] = await Promise.all([
    selectedSlug ? getJobBySlug(tenant.id, selectedSlug) : Promise.resolve(null),
    getJobCount(tenant.id, {}), // unfiltered tenant total
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader
        tenant={tenant}
        defaultQuery={params.q}
        defaultLocation={params.location}
      />

      {/* Context strip: editorial fold-1 element ("not-a-hero") */}
      <ContextStrip
        region={tenant.central_place || tenant.name}
        emphasis={tenant.central_place || tenant.name}
        jobCount={totalJobCount}
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
