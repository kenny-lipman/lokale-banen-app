import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug, getRelatedJobs, parseSalary, mapEmploymentType } from '@/lib/queries'
import { buildJobPostingSchema, buildBreadcrumbSchema } from '@lokale-banen/shared'
import { slugifyCity } from '@lokale-banen/database'
import { TenantHeader } from '@/components/tenant-header'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { JobDetail } from '@/components/job-detail'
import { ApplyButton } from '@/components/apply-button'
import { SaveJobButton } from '@/components/save-job-button'
import { ShareButtons } from '@/components/share-buttons'
import { Footer } from '@/components/footer'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface JobPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: JobPageProps): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant()
  if (!tenant) return {}

  const job = await getJobBySlug(tenant.id, slug)
  if (!job) return {}

  const companyName = job.company?.name || ''
  const tenantTitle = tenant.hero_title || tenant.name
  const title = job.seo_title
    || (companyName
      ? `${job.title} bij ${companyName} | ${tenantTitle}`
      : `${job.title} | ${tenantTitle}`)

  const rawText = (job.seo_description || job.description || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const description = rawText.length > 160
    ? rawText.slice(0, 157) + '...'
    : rawText || `Bekijk de vacature ${job.title} bij ${companyName}`

  const canonicalUrl = `https://${tenant.domain}/vacature/${slug}`
  const isExpired = job.end_date && new Date(job.end_date) < new Date()

  return {
    title,
    description,
    robots: isExpired ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonicalUrl,
      publishedTime: job.published_at || undefined,
      siteName: tenant.name,
    },
    alternates: {
      canonical: canonicalUrl,
      types: {
        'text/markdown': `${canonicalUrl}/md`,
      },
    },
  }
}

export default async function JobPage({ params }: JobPageProps) {
  const { slug } = await params
  const tenant = await getTenant()

  if (!tenant) {
    notFound()
  }

  const job = await getJobBySlug(tenant.id, slug)

  if (!job) {
    notFound()
  }

  const isExpired = job.end_date && new Date(job.end_date) < new Date()

  const relatedJobs = await getRelatedJobs(tenant.id, job.city, job.id)
  const companyName = job.company?.name || 'Onbekend bedrijf'

  // --- Build complete JSON-LD JobPosting using shared schema builder ---
  const salary = parseSalary(job.salary)
  const employmentType = mapEmploymentType(job.employment)

  const sameAs: string[] = []
  if (job.company?.website) sameAs.push(job.company.website)
  if (job.company?.linkedin_url) sameAs.push(job.company.linkedin_url)

  const lat = job.latitude ? parseFloat(job.latitude) : (job.company?.latitude ?? null)
  const lng = job.longitude ? parseFloat(job.longitude) : (job.company?.longitude ?? null)

  const cleanDescription = (job.content_md || job.description || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const validThrough = job.end_date
    ? new Date(job.end_date).toISOString()
    : job.published_at
      ? new Date(new Date(job.published_at).getTime() + 60 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()

  // --- Build BreadcrumbList JSON-LD (3-level: Home > City > Job) ---
  const baseUrl = `https://${tenant.domain}`
  const citySlug = job.city ? slugifyCity(job.city) : null
  const breadcrumbItems = [
    { name: tenant.name, url: `${baseUrl}/` },
    ...(citySlug && job.city
      ? [{ name: `Vacatures in ${job.city}`, url: `${baseUrl}/vacatures/${citySlug}` }]
      : []),
    { name: job.title, url: `${baseUrl}/vacature/${slug}` },
  ]
  const breadcrumbJsonLd = buildBreadcrumbSchema(breadcrumbItems)

  const jsonLd = buildJobPostingSchema({
    title: job.title,
    description: cleanDescription,
    datePosted: job.published_at || job.created_at,
    validThrough,
    employmentType,
    hiringOrganization: {
      name: companyName,
      sameAs: sameAs.length > 0 ? sameAs : undefined,
      logo: job.company?.logo_url,
      kvkNumber: job.company?.kvk,
    },
    jobLocation: {
      streetAddress: job.street || job.company?.street_address,
      city: job.city || job.company?.city || 'Nederland',
      postalCode: job.zipcode || job.company?.postal_code,
      region: job.state,
      country: 'NL',
      latitude: (lat && !isNaN(lat)) ? lat : null,
      longitude: (lng && !isNaN(lng)) ? lng : null,
    },
    salary: salary
      ? { minValue: salary.min, maxValue: salary.max, currency: 'EUR', unitText: salary.unit }
      : null,
    directApply: !job.url,
    identifier: {
      name: tenant.name,
      value: job.id,
    },
    applicantLocationCountry: 'NL',
  })

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      {/* Sub-header with back / breadcrumbs, share, save */}
      <div className="bg-surface" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between h-11 px-4 lg:px-6">
          {/* Mobile: back button */}
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-body text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Terug
          </Link>

          {/* Desktop: breadcrumbs (3-level: Home > City > Job) */}
          <div className="hidden lg:block">
            <Breadcrumbs
              items={[
                { label: tenant.name, href: '/' },
                ...(citySlug && job.city
                  ? [{ label: `Vacatures in ${job.city}`, href: `/vacatures/${citySlug}` }]
                  : []),
                { label: job.title },
              ]}
            />
          </div>

          <div className="flex items-center gap-1">
            <Suspense fallback={<div className="h-10 w-10" />}>
              <SaveJobButton jobId={job.id} />
            </Suspense>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-content mx-auto w-full py-6 px-4 lg:px-8 pb-24 sm:pb-8">
        {/* JSON-LD: JobPosting */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
        {/* JSON-LD: BreadcrumbList */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }}
        />

        <JobDetail job={job} relatedJobs={relatedJobs} />

        {/* Share buttons below job detail */}
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <ShareButtons url={`${baseUrl}/vacature/${slug}`} title={job.title} />
        </div>
      </main>

      <Footer tenant={tenant} />

      {/* Sticky apply button (mobile bottom, desktop inline is in JobDetail) */}
      <ApplyButton
        jobUrl={job.url}
        jobTitle={job.title}
        isExpired={!!isExpired}
      />
    </div>
  )
}

