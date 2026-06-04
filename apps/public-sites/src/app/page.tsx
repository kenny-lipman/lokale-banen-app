import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getTenant } from '@/lib/tenant'
import { buildWebSiteSchema } from '@lokale-banen/shared'
import {
  getJobCount,
  getFilterFacets,
  getCitiesWithJobCounts,
  getMasterJobCount,
  getTopPlatforms,
  getJobsAcrossAllPlatforms,
  type JobFilter,
  type SortOption,
} from '@/lib/queries'
import {
  SiteHeader,
  SearchBanner,
  SiteFooter,
  JobList,
  FilterPanel,
  SortToolbar,
  MobileBottomBar,
} from '@/components/eyeron'
import { MasterHomepage } from '@/components/eyeron/master-homepage'

const VALID_SORTS = ['newest', 'salary_desc', 'oldest', 'nearest'] as const
type ValidSort = (typeof VALID_SORTS)[number]

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  if (!tenant) return { title: 'Lokale Banen' }

  if (tenant.tier === 'master') {
    return {
      title: tenant.hero_title || 'Lokale Banen | Vacatures door heel Nederland',
      description:
        tenant.seo_description ||
        'Vind lokale vacatures in jouw regio. Honderden vacatures via tientallen regionale jobboards door heel Nederland.',
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
  await connection()
  const [params, tenant] = await Promise.all([searchParams, getTenant()])

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-h2 font-bold text-primary mb-2">Domein niet gevonden</h1>
          <p className="text-meta font-light text-muted">
            Dit domein is niet gekoppeld aan een platform.
          </p>
        </div>
      </div>
    )
  }

  // Backward compat: ?selected=slug → /vacature/slug
  if (params.selected) {
    redirect(`/vacature/${params.selected}`)
  }

  // ─── Master aggregator branch ───────────────────────────────────────────
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

  // ─── Regio branch ───────────────────────────────────────────────────────
  const sort: SortOption = VALID_SORTS.includes(params.sort as ValidSort)
    ? (params.sort as SortOption)
    : 'newest'
  const pageNum = parseInt(params.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const userLat = params.lat ? parseFloat(params.lat) : undefined
  const userLng = params.lng ? parseFloat(params.lng) : undefined
  const educationValues = params.education?.split(',')
  const sectorValues = params.sector?.split(',')

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

  const [totalJobsUnfiltered, totalJobsFiltered, facets, cities] = await Promise.all([
    getJobCount(tenant.id, {}),
    getJobCount(tenant.id, filter),
    getFilterFacets(tenant.id),
    getCitiesWithJobCounts(tenant.id),
  ])

  const activeFilterCount =
    (params.type ? params.type.split(',').length : 0) +
    (params.hours ? params.hours.split(',').length : 0) +
    (educationValues?.length || 0) +
    (sectorValues?.length || 0)

  const region = tenant.central_place || stripBanenSuffix(tenant.name)
  const hasLocation = userLat != null && userLng != null

  // JSON-LD WebSite-schema voor sitelinks searchbox
  const baseUrl = tenant.domain ? `https://${tenant.domain}` : ''
  const websiteJsonLd = baseUrl
    ? buildWebSiteSchema({
        name: tenant.name,
        url: baseUrl,
        description: tenant.seo_description,
        searchUrlTemplate: `${baseUrl}/?q={search_term_string}`,
      })
    : null

  // Filter-paneel - gedeeld tussen desktop sidebar en mobile drawer
  const filterPanelProps = {
    facets,
    activeType: params.type,
    activeHours: params.hours,
    activeEducation: params.education,
    activeSector: params.sector,
  }

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

      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad pb-s6">
        <div className="lg:grid lg:gap-gap-content lg:items-start lg:pt-6 lg:[grid-template-columns:var(--content-main-width)_var(--content-sidebar-width)]">
          <div className="min-w-0 pt-5 lg:pt-0">
            <SearchBanner
              region={region}
              jobCount={totalJobsUnfiltered}
              defaultQuery={params.q}
            />

            <p className="text-lead text-primary tracking-tight mt-7 mb-0 max-w-prose">
              Wij verzamelen vacatures van lokale werkgevers in de {region}.
              Alle openstaande functies, dagelijks bijgewerkt.
            </p>

            <SortToolbar
              total={totalJobsFiltered}
              currentPage={page}
              currentSort={sort}
              hasLocation={hasLocation}
              className="mt-6"
            />

            <JobList tenantId={tenant.id} filter={filter} />
          </div>

          <aside
            className="hidden lg:block lg:sticky"
            style={{ top: 'calc(var(--header-height-desk) + 24px)' }}
            aria-label="Filters"
          >
            <FilterPanel {...filterPanelProps} />
          </aside>
        </div>
      </main>

      <MobileBottomBar
        filterDrawerContent={<FilterPanel {...filterPanelProps} hideHeading />}
        activeFilterCount={activeFilterCount}
        resultCount={totalJobsFiltered}
        currentSort={sort}
        hasLocation={hasLocation}
      />

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

/** "AchterhoekseBanen" → "Achterhoek". Fallback voor wanneer central_place leeg is. */
function stripBanenSuffix(name: string): string {
  return name.replace(/[Ss]eBanen$/, '').replace(/Banen$/, '')
}
