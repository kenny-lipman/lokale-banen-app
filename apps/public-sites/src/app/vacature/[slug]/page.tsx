import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug, getRelatedJobs, parseSalary, mapEmploymentType } from '@/lib/queries'
import { buildJobPostingSchema } from '@lokale-banen/shared'
import { TenantHeader } from '@/components/tenant-header'
import { JobDetail } from '@/components/job-detail'
import { ApplyButton } from '@/components/apply-button'
import { SaveJobButton } from '@/components/save-job-button'
import { ArrowLeft, Share2 } from 'lucide-react'
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

  return {
    title,
    description,
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

      {/* Sub-header with back, share, save */}
      <div className="bg-surface" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between h-11 px-4 lg:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-body text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Terug
          </Link>
          <div className="flex items-center gap-1">
            <ShareButton title={job.title} />
            <Suspense fallback={<div className="h-10 w-10" />}>
              <SaveJobButton jobId={job.id} />
            </Suspense>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-content mx-auto w-full py-6 px-4 lg:px-8 pb-24 sm:pb-8">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <JobDetail job={job} relatedJobs={relatedJobs} />
      </main>

      {/* Sticky apply button (mobile bottom, desktop inline is in JobDetail) */}
      <ApplyButton
        jobUrl={job.url}
        jobTitle={job.title}
        isExpired={!!isExpired}
      />
    </div>
  )
}

/**
 * Share button using native Web Share API with fallback.
 */
function ShareButton({ title }: { title: string }) {
  return (
    <button
      className="inline-flex items-center justify-center h-10 w-10 rounded-md text-muted hover:text-foreground hover:bg-background transition-colors"
      aria-label="Deel deze vacature"
    >
      <Share2 className="h-4 w-4" />
    </button>
  )
}
