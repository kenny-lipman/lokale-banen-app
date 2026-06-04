import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import {
  getCompanyBySlug,
  getJobsByCompany,
  getCitiesWithJobCounts,
} from '@/lib/queries'
import { buildBreadcrumbSchema, buildItemListSchema } from '@lokale-banen/shared'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  CompanyProfile,
  VacatureCard,
  EmptyState,
  Pagination,
} from '@/components/eyeron'

interface CompanyPageProps {
  params: Promise<{ 'company-slug': string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({
  params,
  searchParams,
}: CompanyPageProps): Promise<Metadata> {
  const [{ 'company-slug': companySlug }, sp, tenant] = await Promise.all([params, searchParams, getTenant()])
  if (!tenant) return {}

  const company = await getCompanyBySlug(tenant.id, companySlug)
  if (!company) return {}

  const { total } = await getJobsByCompany(tenant.id, company.id, 1)
  const page = parseInt(sp.page || '1', 10) || 1
  const title =
    page > 1
      ? `Vacatures bij ${company.name}, pagina ${page} | ${tenant.name}`
      : `Vacatures bij ${company.name} | ${tenant.name}`
  const description =
    total > 0
      ? `${total} vacature${total !== 1 ? 's' : ''} bij ${company.name}. Bekijk alle banen bij dit bedrijf op ${tenant.name}.`
      : `Vacatures bij ${company.name} op ${tenant.name}.`

  const canonicalBase = `https://${tenant.domain}/bedrijf/${companySlug}`
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
      ...(company.logo_url ? { images: [{ url: company.logo_url }] } : {}),
    },
  }
}

export default async function CompanyPage({ params, searchParams }: CompanyPageProps) {
  const [{ 'company-slug': companySlug }, sp, tenant] = await Promise.all([params, searchParams, getTenant()])
  if (!tenant) notFound()

  const company = await getCompanyBySlug(tenant.id, companySlug)
  if (!company) notFound()

  const pageNum = parseInt(sp.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const [{ jobs, total }, cities] = await Promise.all([
    getJobsByCompany(tenant.id, company.id, page),
    getCitiesWithJobCounts(tenant.id),
  ])
  const totalPages = Math.ceil(total / 20)
  if (page > 1 && page > totalPages) notFound()

  const baseUrl = `https://${tenant.domain}`
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: tenant.name, url: `${baseUrl}/` },
    { name: 'Bedrijven', url: `${baseUrl}/bedrijven` },
    { name: company.name, url: `${baseUrl}/bedrijf/${companySlug}` },
  ])

  const companyOrgJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
  }
  if (company.website) companyOrgJsonLd.url = company.website
  if (company.logo_url) companyOrgJsonLd.logo = company.logo_url
  const sameAs: string[] = []
  if (company.website) sameAs.push(company.website)
  if (company.linkedin_url) sameAs.push(company.linkedin_url)
  if (sameAs.length > 0) companyOrgJsonLd.sameAs = sameAs
  if (company.kvk) {
    companyOrgJsonLd.identifier = {
      '@type': 'PropertyValue',
      propertyID: 'KvK',
      value: company.kvk,
    }
  }
  if (company.city) {
    companyOrgJsonLd.address = {
      '@type': 'PostalAddress',
      addressLocality: company.city,
      addressCountry: 'NL',
      ...(company.postal_code ? { postalCode: company.postal_code } : {}),
      ...(company.street_address ? { streetAddress: company.street_address } : {}),
    }
  }

  const itemListJsonLd = buildItemListSchema({
    name: `Vacatures bij ${company.name}`,
    description: `${total} vacatures bij ${company.name}`,
    url: `${baseUrl}/bedrijf/${companySlug}`,
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
            __html: JSON.stringify(companyOrgJsonLd).replace(/</g, '\\u003c'),
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
            { label: 'Bedrijven', href: '/bedrijven' },
            { label: company.name },
          ]}
        />

        <CompanyProfile company={company} jobCount={total} />

        {jobs.length > 0 ? (
          <>
            <h2 className="text-h2 font-bold text-primary tracking-tight m-0 mb-6">
              Vacatures bij {company.name}
            </h2>
            <div className="flex flex-col gap-s3">
              {jobs.map((job) => (
                <VacatureCard key={job.id} job={job} />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              basePath={`/bedrijf/${companySlug}`}
            />
          </>
        ) : (
          <EmptyState
            title={`Geen openstaande vacatures bij ${company.name}`}
            body="Er zijn momenteel geen openstaande posities. Kom binnenkort terug, er komen regelmatig nieuwe vacatures bij."
          />
        )}
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
