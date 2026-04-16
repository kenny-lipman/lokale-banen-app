import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTenant } from '@/lib/tenant'
import { buildWebSiteSchema } from '@lokale-banen/shared'

export const dynamic = 'force-dynamic'
import { getJobCount, getFilterFacets, getMasterJobCount, getTopPlatforms, getJobsAcrossAllPlatforms } from '@/lib/queries'
import { TenantHeader } from '@/components/tenant-header'
import { FilterBar } from '@/components/filter-bar'
import { EditorialSearchBar } from '@/components/editorial-search-bar'
import { ContextStrip } from '@/components/context-strip'
import { JobList } from '@/components/job-list'
import { FilterSidebar, FilterGroups } from '@/components/filter-sidebar'
import { MobileFilterBar } from '@/components/mobile-filter-bar'
import { Footer } from '@/components/footer'
import { MasterHomepage } from '@/components/master-homepage'
import type { JobFilter, SortOption } from '@/lib/queries'

const VALID_SORTS = ['newest', 'salary_desc', 'oldest', 'nearest'] as const
type ValidSort = typeof VALID_SORTS[number]

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  if (!tenant) return { title: 'Lokale Banen' }

  if (tenant.tier === 'master') {
    return {
      title: tenant.hero_title || 'Lokale Banen — Vacatures door heel Nederland',
      description:
        tenant.seo_description ||
        'Vind lokale vacatures in jouw regio. Honderden vacatures via 24 regionale jobboards door heel Nederland.',
      alternates: {
        canonical: tenant.domain ? `https://${tenant.domain}` : undefined,
      },
    }
  }

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
    hours?: string
    education?: string
    sector?: string
    distance?: string
    page?: string
    selected?: string
    sort?: string
    lat?: string
    lng?: string
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

  // Backward compat: redirect ?selected=slug to /vacature/slug
  if (params.selected) {
    redirect(`/vacature/${params.selected}`)
  }

  // Master aggregator — lokalebanen.nl shows all 24 regional platforms
  if (tenant.tier === 'master') {
    const [totalJobs, platforms, { jobs: recentJobs }] = await Promise.all([
      getMasterJobCount(),
      getTopPlatforms(),
      getJobsAcrossAllPlatforms({ limit: 12 }),
    ])
    return (
      <MasterHomepage
        tenant={tenant}
        platforms={platforms}
        recentJobs={recentJobs}
        totalJobs={totalJobs}
      />
    )
  }

  const sort: SortOption = VALID_SORTS.includes(params.sort as ValidSort)
    ? (params.sort as SortOption)
    : 'newest'
  const pageNum = parseInt(params.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const userLat = params.lat ? parseFloat(params.lat) : undefined
  const userLng = params.lng ? parseFloat(params.lng) : undefined

  // Parse multi-value filter params
  const educationValues = params.education ? params.education.split(',') : undefined
  const sectorValues = params.sector ? params.sector.split(',') : undefined

  const filter: JobFilter = {
    query: params.q,
    location: params.location,
    type: params.type,
    hours: params.hours,
    education: educationValues,
    sector: sectorValues,
    page,
    sort,
    userLat: userLat && !isNaN(userLat) ? userLat : undefined,
    userLng: userLng && !isNaN(userLng) ? userLng : undefined,
  }

  const [totalJobCount, facets] = await Promise.all([
    getJobCount(tenant.id, {}),
    getFilterFacets(tenant.id),
  ])

  // Count active filters for mobile badge
  const activeFilterCount =
    (params.type ? params.type.split(',').length : 0) +
    (params.hours ? 1 : 0) +
    (educationValues?.length || 0) +
    (sectorValues?.length || 0) +
    (params.distance && params.distance !== 'all' ? 1 : 0)

  // JSON-LD WebSite schema with SearchAction for Google sitelinks searchbox
  const baseUrl = tenant.domain ? `https://${tenant.domain}` : ''
  const websiteJsonLd = baseUrl
    ? buildWebSiteSchema({
        name: tenant.name,
        url: baseUrl,
        description: tenant.seo_description,
        searchUrlTemplate: `${baseUrl}/?q={search_term_string}`,
      })
    : null

  return (
    <div className="flex flex-col min-h-screen">
      {websiteJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}

      <TenantHeader
        tenant={tenant}
        defaultQuery={params.q}
        defaultLocation={params.location}
      />

      <ContextStrip
        region={tenant.central_place || tenant.name}
        emphasis={tenant.central_place || tenant.name}
        jobCount={totalJobCount}
      />

      <EditorialSearchBar
        defaultQuery={params.q}
        defaultLocation={params.location}
        locationPlaceholder={tenant.central_place || 'Postcode of plaats'}
        lat={params.lat}
        lng={params.lng}
      />

      {/* Filter chips — visible on mobile, hidden on desktop when sidebar exists */}
      <div className="lg:hidden">
        <FilterBar
          activeType={params.type}
          query={params.q}
          location={params.location}
          sort={params.sort}
          lat={params.lat}
          lng={params.lng}
        />
      </div>

      <main
        className="mx-auto w-full flex-1"
        style={{ maxWidth: 'var(--max)', padding: '0 var(--pad) 64px' }}
      >
        <div className="lg:grid lg:grid-cols-[1fr_264px] lg:gap-8 items-start">
          {/* Cards column */}
          <div className="min-w-0">
            {/* Intro text */}
            <div style={{ paddingBottom: 20, marginBottom: 4 }}>
              <p
                style={{
                  fontSize: '0.9375rem',
                  color: 'var(--text-2)',
                  lineHeight: 1.6,
                  margin: 0,
                  maxWidth: '65ch',
                }}
              >
                Wij verzamelen vacatures van lokale werkgevers in de{' '}
                {tenant.central_place || tenant.name} — alle openstaande
                functies, dagelijks bijgewerkt.
              </p>
            </div>

            <JobList
              tenantId={tenant.id}
              filter={filter}
            />
          </div>

          {/* Filter sidebar — desktop only */}
          <FilterSidebar
            tenant={tenant}
            facets={facets}
            activeType={params.type}
            activeHours={params.hours}
            activeEducation={params.education}
            activeSector={params.sector}
            activeDistance={params.distance}
            totalJobs={totalJobCount}
          />
        </div>
      </main>

      <Footer tenant={tenant} />

      {/* Mobile fixed bottom bar — filter + sort */}
      <MobileFilterBar
        activeFilterCount={activeFilterCount}
        currentSort={sort}
        hasLocation={userLat != null && userLng != null}
      >
        <FilterGroups
          facets={facets}
          activeType={params.type}
          activeHours={params.hours}
          activeEducation={params.education}
          activeSector={params.sector}
          activeDistance={params.distance}
        />
      </MobileFilterBar>
    </div>
  )
}
