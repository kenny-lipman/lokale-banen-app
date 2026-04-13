import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTenant } from '@/lib/tenant'
import { getJobsByCitySlug, getNearbyCities } from '@/lib/queries'
import { buildBreadcrumbSchema, buildItemListSchema } from '@lokale-banen/shared'
import { TenantHeader } from '@/components/tenant-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { JobCard } from '@/components/job-card'
import { Pagination } from '@/components/pagination'
import { NearbyCities } from '@/components/nearby-cities'
import { Footer } from '@/components/footer'

interface CityPageProps {
  params: Promise<{ 'city-slug': string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params, searchParams }: CityPageProps): Promise<Metadata> {
  const [{ 'city-slug': citySlug }, sp] = await Promise.all([params, searchParams])
  const tenant = await getTenant()
  if (!tenant) return {}

  const { total, cityName } = await getJobsByCitySlug(tenant.id, citySlug, 1)
  if (!cityName) return {}

  const page = parseInt(sp.page || '1', 10) || 1
  const title = page > 1
    ? `Vacatures in ${cityName} — Pagina ${page} | ${tenant.name}`
    : `Vacatures in ${cityName} | ${tenant.name}`
  const description = total > 0
    ? `${total} vacature${total !== 1 ? 's' : ''} in ${cityName}. Bekijk het actuele aanbod bij ${tenant.name}.`
    : `Vacatures in ${cityName} bij ${tenant.name}.`

  const canonicalBase = `https://${tenant.domain}/vacatures/${citySlug}`
  const canonical = page > 1 ? `${canonicalBase}?page=${page}` : canonicalBase

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      siteName: tenant.name,
    },
  }
}

export default async function CityPage({ params, searchParams }: CityPageProps) {
  const [{ 'city-slug': citySlug }, sp] = await Promise.all([params, searchParams])
  const tenant = await getTenant()

  if (!tenant) {
    notFound()
  }

  const pageNum = parseInt(sp.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const { jobs, total, cityName } = await getJobsByCitySlug(tenant.id, citySlug, page)

  if (!cityName) {
    notFound()
  }

  const totalPages = Math.ceil(total / 20)

  // 404 for out-of-range pages (but allow page 1 on empty results for nearby cities)
  if (page > 1 && page > totalPages) {
    notFound()
  }

  const nearbyCities = await getNearbyCities(tenant.id, citySlug)
  const baseUrl = `https://${tenant.domain}`

  // JSON-LD: BreadcrumbList
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: tenant.name, url: `${baseUrl}/` },
    { name: `Vacatures in ${cityName}`, url: `${baseUrl}/vacatures/${citySlug}` },
  ])

  // JSON-LD: ItemList
  const itemListJsonLd = buildItemListSchema({
    name: `Vacatures in ${cityName}`,
    description: `${total} vacatures in ${cityName} bij ${tenant.name}`,
    url: `${baseUrl}/vacatures/${citySlug}`,
    numberOfItems: jobs.length,
    items: jobs.map(job => ({
      name: job.title,
      url: `${baseUrl}/vacature/${job.slug || job.id}`,
    })),
  })

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      {/* Breadcrumbs bar */}
      <div className="bg-surface" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto h-11 px-4 lg:px-6 flex items-center">
          <Breadcrumbs
            items={[
              { label: tenant.name, href: '/' },
              { label: `Vacatures in ${cityName}` },
            ]}
          />
        </div>
      </div>

      <main className="flex-1 max-w-[1280px] mx-auto w-full py-6 px-4 lg:px-8">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
        />

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-display text-foreground">
            Vacatures in {cityName}
          </h1>
          <p className="text-body text-muted mt-1">
            {total} vacature{total !== 1 ? 's' : ''} gevonden
          </p>
        </div>

        {/* Job list or empty state */}
        {jobs.length > 0 ? (
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border)' }}
          >
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} variant="mobile" />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-body text-muted">
              Er zijn momenteel geen vacatures in {cityName}.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center mt-4 h-9 px-5 rounded-lg text-button text-primary transition-colors hover:bg-primary-light"
              style={{ border: '1px solid var(--primary)' }}
            >
              Bekijk alle vacatures
            </Link>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath={`/vacatures/${citySlug}`}
        />

        {/* Nearby cities */}
        <NearbyCities cities={nearbyCities} />
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
