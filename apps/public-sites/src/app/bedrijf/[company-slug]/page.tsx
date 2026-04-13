import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getCompanyBySlug, getJobsByCompany } from '@/lib/queries'
import { buildBreadcrumbSchema, buildItemListSchema } from '@lokale-banen/shared'
import { TenantHeader } from '@/components/tenant-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { CompanyProfileCard } from '@/components/company-profile-card'
import { JobCard } from '@/components/job-card'
import { Pagination } from '@/components/pagination'
import { Footer } from '@/components/footer'

interface CompanyPageProps {
  params: Promise<{ 'company-slug': string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params, searchParams }: CompanyPageProps): Promise<Metadata> {
  const [{ 'company-slug': companySlug }, sp] = await Promise.all([params, searchParams])
  const tenant = await getTenant()
  if (!tenant) return {}

  const company = await getCompanyBySlug(tenant.id, companySlug)
  if (!company) return {}

  const { total } = await getJobsByCompany(tenant.id, company.id, 1)

  const page = parseInt(sp.page || '1', 10) || 1
  const title = page > 1
    ? `Vacatures bij ${company.name} — Pagina ${page} | ${tenant.name}`
    : `Vacatures bij ${company.name} | ${tenant.name}`
  const description = total > 0
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
  const [{ 'company-slug': companySlug }, sp] = await Promise.all([params, searchParams])
  const tenant = await getTenant()

  if (!tenant) {
    notFound()
  }

  const company = await getCompanyBySlug(tenant.id, companySlug)
  if (!company) {
    notFound()
  }

  const pageNum = parseInt(sp.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const { jobs, total } = await getJobsByCompany(tenant.id, company.id, page)
  const totalPages = Math.ceil(total / 20)

  if (page > 1 && page > totalPages) {
    notFound()
  }

  const baseUrl = `https://${tenant.domain}`

  // JSON-LD: BreadcrumbList
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: tenant.name, url: `${baseUrl}/` },
    { name: company.name, url: `${baseUrl}/bedrijf/${companySlug}` },
  ])

  // JSON-LD: Organization (the company, not the tenant)
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

  // JSON-LD: ItemList
  const itemListJsonLd = buildItemListSchema({
    name: `Vacatures bij ${company.name}`,
    description: `${total} vacatures bij ${company.name}`,
    url: `${baseUrl}/bedrijf/${companySlug}`,
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
              { label: company.name },
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(companyOrgJsonLd).replace(/</g, '\\u003c') }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c') }}
        />

        {/* Company profile */}
        <CompanyProfileCard company={company} />

        {/* Job count header */}
        <div className="mt-8 mb-4">
          <h2 className="text-h2 text-foreground">
            Vacatures ({total})
          </h2>
        </div>

        {/* Job list */}
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
              Er zijn momenteel geen vacatures bij {company.name}.
            </p>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath={`/bedrijf/${companySlug}`}
        />
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
