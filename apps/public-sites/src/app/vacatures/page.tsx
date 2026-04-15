import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getApprovedJobs } from '@/lib/queries'
import { buildBreadcrumbSchema, buildItemListSchema } from '@lokale-banen/shared'
import { TenantHeader } from '@/components/tenant-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { JobCard } from '@/components/job-card'
import { Pagination } from '@/components/pagination'
import { Footer } from '@/components/footer'

interface VacaturesPageProps {
  searchParams: Promise<{
    page?: string
    q?: string
    type?: string
    sort?: 'newest' | 'salary_desc' | 'oldest'
  }>
}

export async function generateMetadata({ searchParams }: VacaturesPageProps): Promise<Metadata> {
  const sp = await searchParams
  const tenant = await getTenant()
  if (!tenant) return {}

  const page = parseInt(sp.page || '1', 10) || 1
  const title = page > 1 ? `Alle vacatures — Pagina ${page}` : 'Alle vacatures'
  const description =
    tenant.seo_description ??
    `Bekijk het actuele vacature-aanbod bij ${tenant.name}.`

  const hostDomain = tenant.domain ?? tenant.preview_domain ?? ''
  const canonicalBase = hostDomain ? `https://${hostDomain}/vacatures` : '/vacatures'
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

export default async function VacaturesPage({ searchParams }: VacaturesPageProps) {
  const sp = await searchParams
  const tenant = await getTenant()

  if (!tenant) {
    notFound()
  }

  const pageNum = parseInt(sp.page || '1', 10)
  const page = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum

  const { jobs, total } = await getApprovedJobs(tenant.id, {
    page,
    query: sp.q,
    type: sp.type,
    sort: sp.sort,
  })

  const totalPages = Math.max(1, Math.ceil(total / 20))
  if (page > 1 && page > totalPages) {
    notFound()
  }

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
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      <div className="bg-surface" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto h-11 px-4 lg:px-6 flex items-center">
          <Breadcrumbs
            items={[
              { label: tenant.name, href: '/' },
              { label: 'Alle vacatures' },
            ]}
          />
        </div>
      </div>

      <main className="flex-1 max-w-[1280px] mx-auto w-full py-6 px-4 lg:px-8">
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

        <div className="mb-6">
          <h1 className="text-display text-foreground">Alle vacatures</h1>
          <p className="text-body text-muted mt-1">
            {total} vacature{total !== 1 ? 's' : ''} bij {tenant.name}
          </p>
        </div>

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
              Er zijn momenteel nog geen vacatures bij {tenant.name}. Kom snel
              terug — er komen er regelmatig bij.
            </p>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          basePath="/vacatures"
        />
      </main>

      <Footer tenant={tenant} />
    </div>
  )
}
