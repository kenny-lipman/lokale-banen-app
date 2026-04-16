import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getApprovedJobs, getJobsAcrossAllPlatforms } from '@/lib/queries'
import { buildBreadcrumbSchema, buildItemListSchema } from '@lokale-banen/shared'
import { TenantHeader } from '@/components/tenant-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { JobCard } from '@/components/job-card'
import { EditorialJobCard } from '@/components/editorial-job-card'
import { PlatformBadge } from '@/components/master-platform-card'
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

  if (tenant.tier === 'master') {
    const title = page > 1 ? `Alle vacatures — Pagina ${page} | Lokale Banen` : 'Alle vacatures | Lokale Banen'
    const description = 'Bladeren door honderden lokale vacatures van 24 regionale jobboards door heel Nederland.'
    const hostDomain = tenant.domain ?? tenant.preview_domain ?? ''
    const canonicalBase = hostDomain ? `https://${hostDomain}/vacatures` : '/vacatures'
    const canonical = page > 1 ? `${canonicalBase}?page=${page}` : canonicalBase
    return { title, description, alternates: { canonical } }
  }

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

  // ── Master aggregator branch ──────────────────────────────────────────────
  if (tenant.tier === 'master') {
    const LIMIT = 20
    const offset = (page - 1) * LIMIT
    const { jobs: masterJobs, total } = await getJobsAcrossAllPlatforms({
      limit: LIMIT,
      offset,
      ...(sp.q ? { city: sp.q } : {}),
    })

    const totalPages = Math.max(1, Math.ceil(total / LIMIT))
    if (page > 1 && page > totalPages) notFound()

    return (
      <div className="flex flex-col min-h-screen bg-surface">
        <TenantHeader tenant={tenant} showSearch={false} />

        <div className="bg-surface" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="max-w-[1280px] mx-auto h-11 px-4 lg:px-6 flex items-center">
            <Breadcrumbs
              items={[
                { label: 'Lokale Banen', href: '/' },
                { label: 'Alle vacatures' },
              ]}
            />
          </div>
        </div>

        <main className="flex-1 max-w-[1280px] mx-auto w-full py-6 px-4 lg:px-8">
          <div className="mb-6">
            <h1 className="text-display text-foreground">Alle vacatures</h1>
            <p className="text-body text-muted mt-1">
              {total.toLocaleString('nl-NL')} vacatures door heel Nederland
            </p>
          </div>

          {masterJobs.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {masterJobs.map((job) => (
                <div key={job.id} style={{ position: 'relative' }}>
                  {job.primary_platform && (
                    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
                      <PlatformBadge
                        name={job.primary_platform.name}
                        host={job.primary_platform.preview_domain ?? job.primary_platform.domain}
                      />
                    </div>
                  )}
                  <EditorialJobCard
                    job={job}
                    variant="mobile"
                    href={
                      job.primary_platform
                        ? buildMasterHref(job)
                        : `/vacature/${job.slug || job.id}`
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-body text-muted">Geen vacatures gevonden.</p>
            </div>
          )}

          <Pagination currentPage={page} totalPages={totalPages} basePath="/vacatures" />
        </main>

        <Footer tenant={tenant} />
      </div>
    )
  }

  // ── Regional platform branch ──────────────────────────────────────────────
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

/** Build canonical URL for a master job → primary platform domain. */
function buildMasterHref(job: { slug?: string | null; id: string; primary_platform: { preview_domain: string | null; domain: string | null } | null }): string {
  const plat = job.primary_platform
  if (!plat) return `/vacature/${job.slug || job.id}`
  const host = plat.preview_domain ?? plat.domain
  if (host) return `https://${host}/vacature/${job.slug || job.id}`
  return `/vacature/${job.slug || job.id}`
}
