import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import {
  getApprovedJobs,
  getJobCount,
  getFilterFacets,
  getJobsAcrossAllPlatforms,
  getCitiesWithJobCounts,
  type JobFilter,
  type SortOption,
} from '@/lib/queries'
import { buildBreadcrumbSchema, buildItemListSchema } from '@lokale-banen/shared'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  VacatureCard,
  Pagination,
  EmptyState,
  PillButton,
  FilterPanel,
  SortToolbar,
  MobileBottomBar,
} from '@/components/eyeron'

interface VacaturesPageProps {
  searchParams: Promise<{
    page?: string
    q?: string
    type?: string
    hours?: string
    education?: string
    sector?: string
    sort?: 'newest' | 'salary_desc' | 'oldest'
  }>
}

const PAGE_SIZE = 20
const VALID_SORTS = ['newest', 'salary_desc', 'oldest'] as const
type ValidSort = (typeof VALID_SORTS)[number]

export async function generateMetadata({
  searchParams,
}: VacaturesPageProps): Promise<Metadata> {
  const sp = await searchParams
  const tenant = await getTenant()
  if (!tenant) return {}

  const page = parseInt(sp.page || '1', 10) || 1
  const hostDomain = tenant.domain ?? tenant.preview_domain ?? ''
  const canonicalBase = hostDomain ? `https://${hostDomain}/vacatures` : '/vacatures'
  const canonical = page > 1 ? `${canonicalBase}?page=${page}` : canonicalBase

  if (tenant.tier === 'master') {
    return {
      title:
        page > 1
          ? `Alle vacatures, pagina ${page} | Lokale Banen`
          : 'Alle vacatures | Lokale Banen',
      description:
        'Bladeren door honderden lokale vacatures van tientallen regionale jobboards door heel Nederland.',
      alternates: { canonical },
    }
  }

  return {
    title: page > 1 ? `Alle vacatures, pagina ${page}` : 'Alle vacatures',
    description:
      tenant.seo_description ?? `Bekijk het actuele vacature-aanbod bij ${tenant.name}.`,
    alternates: { canonical },
    openGraph: {
      title: page > 1 ? `Alle vacatures, pagina ${page}` : 'Alle vacatures',
      description:
        tenant.seo_description ?? `Bekijk het actuele vacature-aanbod bij ${tenant.name}.`,
      type: 'website',
      url: canonical,
      siteName: tenant.name,
    },
  }
}

export default async function VacaturesPage({ searchParams }: VacaturesPageProps) {
  const sp = await searchParams
  const tenant = await getTenant()
  if (!tenant) notFound()

  const pageNum = parseInt(sp.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  // ── Master aggregator ───────────────────────────────────────────────────
  if (tenant.tier === 'master') {
    const offset = (page - 1) * PAGE_SIZE
    const [{ jobs, total }, cities] = await Promise.all([
      getJobsAcrossAllPlatforms({
        limit: PAGE_SIZE,
        offset,
        ...(sp.q ? { city: sp.q } : {}),
      }),
      getCitiesWithJobCounts(tenant.id),
    ])
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > 1 && page > totalPages) notFound()

    return (
      <div className="flex flex-col min-h-screen">
        <SiteHeader tenant={tenant} />
        <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
          <Breadcrumbs
            className="mb-5"
            items={[
              { label: 'Lokale Banen', href: '/' },
              { label: 'Alle vacatures' },
            ]}
          />
          <PageHero
            title="Alle vacatures"
            description={`${total.toLocaleString('nl-NL')} vacatures door heel Nederland.`}
          />

          {jobs.length > 0 ? (
            <div className="flex flex-col gap-[18px]">
              {jobs.map((job) => (
                <VacatureCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}

          <Pagination currentPage={page} totalPages={totalPages} basePath="/vacatures" />
        </main>
        <SiteFooter tenant={tenant} cities={cities} />
      </div>
    )
  }

  // ── Regio ───────────────────────────────────────────────────────────────
  const sort: SortOption = VALID_SORTS.includes(sp.sort as ValidSort)
    ? (sp.sort as SortOption)
    : 'newest'

  const educationValues = sp.education?.split(',')
  const sectorValues = sp.sector?.split(',')

  const filter: JobFilter = {
    query: sp.q,
    type: sp.type,
    hours: sp.hours,
    education: educationValues,
    sector: sectorValues,
    page,
    sort,
  }

  const [{ jobs, total }, totalJobsUnfiltered, facets, cities] = await Promise.all([
    getApprovedJobs(tenant.id, filter),
    getJobCount(tenant.id, {}),
    getFilterFacets(tenant.id),
    getCitiesWithJobCounts(tenant.id),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (page > 1 && page > totalPages) notFound()

  const activeFilterCount =
    (sp.type ? sp.type.split(',').length : 0) +
    (sp.hours ? sp.hours.split(',').length : 0) +
    (educationValues?.length || 0) +
    (sectorValues?.length || 0)

  const hostDomain = tenant.domain ?? tenant.preview_domain ?? ''
  const baseUrl = hostDomain ? `https://${hostDomain}` : ''
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: tenant.name, url: `${baseUrl}/` },
    { name: 'Alle vacatures', url: `${baseUrl}/vacatures` },
  ])
  const itemListJsonLd = buildItemListSchema({
    name: `Alle vacatures bij ${tenant.name}`,
    description: `${total} vacatures bij ${tenant.name}`,
    url: `${baseUrl}/vacatures`,
    numberOfItems: jobs.length,
    items: jobs.map((job) => ({
      name: job.title,
      url: `${baseUrl}/vacature/${job.slug || job.id}`,
    })),
  })

  const filterPanelProps = {
    facets,
    activeType: sp.type,
    activeHours: sp.hours,
    activeEducation: sp.education,
    activeSector: sp.sector,
  }

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8 pb-15">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c'),
          }}
        />

        <Breadcrumbs
          className="mb-5"
          items={[
            { label: tenant.name, href: '/' },
            { label: 'Alle vacatures' },
          ]}
        />
        <PageHero
          title="Alle vacatures"
          description={`${totalJobsUnfiltered.toLocaleString('nl-NL')} vacature${
            totalJobsUnfiltered !== 1 ? 's' : ''
          } bij ${tenant.name}.`}
        />

        <div className="lg:grid lg:gap-gap-content lg:items-start lg:pt-6 lg:[grid-template-columns:var(--content-main-width)_var(--content-sidebar-width)]">
          <div className="min-w-0">
            <SortToolbar
              total={total}
              currentPage={page}
              currentSort={sort}
              hasLocation={false}
              className="mt-2"
            />

            {jobs.length > 0 ? (
              <div className="flex flex-col gap-[18px]">
                {jobs.map((job) => (
                  <VacatureCard key={job.id} job={job} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={
                  activeFilterCount > 0
                    ? 'Geen vacatures gevonden met deze filters'
                    : `Nog geen vacatures bij ${tenant.name}`
                }
                body={
                  activeFilterCount > 0
                    ? 'Pas je filters aan om meer resultaten te zien.'
                    : 'Er komen regelmatig nieuwe vacatures bij. Kom binnenkort terug, of zet een melding in je account.'
                }
                action={<PillButton href="/vacatures">Wis alle filters</PillButton>}
              />
            )}

            <Pagination currentPage={page} totalPages={totalPages} basePath="/vacatures" />
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
        resultCount={total}
        currentSort={sort}
        hasLocation={false}
      />

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
