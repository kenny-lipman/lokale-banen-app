import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTenant } from '@/lib/tenant'
import {
  getJobsByCitySlug,
  getNearbyCities,
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
  ArrowRight,
} from '@/components/eyeron'

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
  if (!tenant) notFound()

  const pageNum = parseInt(sp.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const [{ jobs, total, cityName }, nearbyCities, cities] = await Promise.all([
    getJobsByCitySlug(tenant.id, citySlug, page),
    getNearbyCities(tenant.id, citySlug),
    getCitiesWithJobCounts(tenant.id),
  ])
  if (!cityName) notFound()

  const totalPages = Math.ceil(total / 20)
  if (page > 1 && page > totalPages) notFound()

  const baseUrl = `https://${tenant.domain}`
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: tenant.name, url: `${baseUrl}/` },
    { name: `Vacatures in ${cityName}`, url: `${baseUrl}/vacatures/${citySlug}` },
  ])
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
            { label: 'Steden', href: '/vacatures' },
            { label: cityName },
          ]}
        />

        <PageHero
          eyebrow={`Vacatures in regio ${tenant.name}`}
          title={`Vacatures in ${cityName}`}
          accent={cityName}
          description={
            total > 0
              ? `${total.toLocaleString('nl-NL')} actuele vacature${total !== 1 ? 's' : ''} in ${cityName}. Lokaal werk, dichter bij huis.`
              : `Op dit moment geen vacatures in ${cityName}.`
          }
        />

        {jobs.length > 0 ? (
          <div className="flex flex-col gap-[18px]">
            {jobs.map((job) => (
              <VacatureCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`Geen vacatures in ${cityName}`}
            body="Probeer een nabijgelegen stad of bekijk alle vacatures in de regio."
            action={<PillButton href="/">Bekijk alle vacatures</PillButton>}
          />
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath={`/vacatures/${citySlug}`}
        />

        {nearbyCities.length > 0 && (
          <section className="mt-12 pt-8 border-t border-divider">
            <h2 className="text-h2 font-bold text-primary tracking-tight m-0 mb-4">
              Nabijgelegen plaatsen
            </h2>
            <ul className="flex flex-wrap gap-2">
              {nearbyCities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/vacatures/${c.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-primary text-meta font-bold tracking-tight text-primary hover:bg-primary-tint transition-colors"
                  >
                    {c.city}
                    <span className="text-body font-light">({c.count})</span>
                    <ArrowRight width={11} height={8} className="text-secondary" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
