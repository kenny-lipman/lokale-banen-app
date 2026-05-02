import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import {
  getApprovedJobs,
  getJobsAcrossAllPlatforms,
  getCitiesWithJobCounts,
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
} from '@/components/eyeron'

interface VacaturesPageProps {
  searchParams: Promise<{
    page?: string
    q?: string
    type?: string
    sort?: 'newest' | 'salary_desc' | 'oldest'
  }>
}

const PAGE_SIZE = 20

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
          ? `Alle vacatures — Pagina ${page} | Lokale Banen`
          : 'Alle vacatures | Lokale Banen',
      description:
        'Bladeren door honderden lokale vacatures van tientallen regionale jobboards door heel Nederland.',
      alternates: { canonical },
    }
  }

  return {
    title: page > 1 ? `Alle vacatures — Pagina ${page}` : 'Alle vacatures',
    description:
      tenant.seo_description ?? `Bekijk het actuele vacature-aanbod bij ${tenant.name}.`,
    alternates: { canonical },
    openGraph: {
      title: page > 1 ? `Alle vacatures — Pagina ${page}` : 'Alle vacatures',
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
  const [{ jobs, total }, cities] = await Promise.all([
    getApprovedJobs(tenant.id, {
      page,
      query: sp.q,
      type: sp.type,
      sort: sp.sort,
    }),
    getCitiesWithJobCounts(tenant.id),
  ])
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (page > 1 && page > totalPages) notFound()

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

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
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
          description={`${total.toLocaleString('nl-NL')} vacature${total !== 1 ? 's' : ''} bij ${tenant.name}.`}
        />

        {jobs.length > 0 ? (
          <div className="flex flex-col gap-[18px]">
            {jobs.map((job) => (
              <VacatureCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`Nog geen vacatures bij ${tenant.name}`}
            body="Er komen regelmatig nieuwe vacatures bij. Kom binnenkort terug, of zet een melding in je account."
            action={<PillButton href="/">Naar de homepage</PillButton>}
          />
        )}

        <Pagination currentPage={page} totalPages={totalPages} basePath="/vacatures" />
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
