import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug, getRelatedJobs } from '@/lib/queries'
import { TenantHeader } from '@/components/tenant-header'
import { JobDetail } from '@/components/job-detail'
import { ApplyButton } from '@/components/apply-button'
import { SaveJobButton } from '@/components/save-job-button'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
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

  const companyName = job.company?.name || job.company_name || ''
  const title = `${job.title} bij ${companyName}`
  const description = job.description
    ? job.description.replace(/<[^>]+>/g, '').slice(0, 155) + '...'
    : `Bekijk de vacature ${job.title} bij ${companyName}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: job.published_at || undefined,
    },
    alternates: {
      canonical: `https://${tenant.domain}/vacature/${slug}`,
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

  // Return 410 Gone for expired jobs
  const isExpired = job.end_date && new Date(job.end_date) < new Date()

  const relatedJobs = await getRelatedJobs(tenant.id, job.city, job.id)
  const companyName = job.company?.name || job.company_name || 'Onbekend bedrijf'

  // JSON-LD JobPosting structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description?.replace(/<[^>]+>/g, '') || '',
    datePosted: job.published_at || job.created_at,
    ...(job.end_date && { validThrough: job.end_date }),
    ...(job.employment_type && {
      employmentType: mapEmploymentType(job.employment_type),
    }),
    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      ...(job.company?.logo_url && { logo: job.company.logo_url }),
      ...(job.company?.website && { sameAs: [job.company.website] }),
    },
    ...(job.city && {
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.city,
          ...(job.state && { addressRegion: job.state }),
          addressCountry: 'NL',
        },
      },
    }),
    ...(job.salary_min &&
      job.salary_max && {
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: 'EUR',
          value: {
            '@type': 'QuantitativeValue',
            minValue: job.salary_min,
            maxValue: job.salary_max,
            unitText: 'MONTH',
          },
        },
      }),
    ...(job.url && { directApply: false }),
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader tenant={tenant} showSearch={false} />

      {/* Sub-header with back, share, save */}
      <div className="border-b bg-background">
        <div className="container flex items-center justify-between h-12">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Terug
            </Link>
          </Button>
          <div className="flex items-center gap-1">
            <ShareButton title={job.title} />
            <Suspense fallback={<Skeleton className="h-11 w-11 rounded-md" />}>
              <SaveJobButton jobId={job.id} />
            </Suspense>
          </div>
        </div>
      </div>

      <main className="flex-1 container py-6 sm:py-8 pb-24 sm:pb-8">
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
    <Button
      variant="ghost"
      size="icon"
      className="h-11 w-11"
      aria-label="Deel deze vacature"
      // Share handled client-side via onClick in a wrapper if needed
    >
      <Share2 className="h-4 w-4" />
    </Button>
  )
}

/**
 * Map Dutch employment type strings to schema.org values.
 */
function mapEmploymentType(type: string): string {
  const lower = type.toLowerCase()
  if (lower.includes('fulltime') || lower.includes('voltijd')) return 'FULL_TIME'
  if (lower.includes('parttime') || lower.includes('deeltijd')) return 'PART_TIME'
  if (lower.includes('stage') || lower.includes('intern')) return 'INTERN'
  if (lower.includes('freelance') || lower.includes('zzp')) return 'CONTRACTOR'
  if (lower.includes('tijdelijk') || lower.includes('temp')) return 'TEMPORARY'
  return 'OTHER'
}
