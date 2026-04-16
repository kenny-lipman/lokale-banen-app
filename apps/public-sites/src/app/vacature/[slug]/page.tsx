import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import { getJobBySlug, getMasterJobBySlug, getRelatedJobs, parseSalary, mapEmploymentType } from '@/lib/queries'
import { getCanonicalInfo } from '@/lib/canonical'
import { buildJobPostingSchema, buildBreadcrumbSchema } from '@lokale-banen/shared'
import { slugifyCity } from '@lokale-banen/database'
import { isJobSaved } from '@/app/actions/saved-jobs'
import { formatRelative } from '@/lib/utils'
import { TenantHeader } from '@/components/tenant-header'
import { Wegwijzer } from '@/components/wegwijzer'
import { JobDetail } from '@/components/job-detail'
import { ApplyButton } from '@/components/apply-button'
import { SaveJobButton } from '@/components/save-job-button'
import { ShareButtons } from '@/components/share-buttons'
import { Footer } from '@/components/footer'
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

  // Multi-regio canonical: resolve primary platform for this job posting.
  // Falls back to the current tenant host if no junction/platform info is available.
  const canonical = await getCanonicalInfo(job.id, slug)
  const effectiveDomain = tenant.domain ?? tenant.preview_domain
  const canonicalUrl = canonical?.canonicalUrl ?? (effectiveDomain ? `https://${effectiveDomain}/vacature/${slug}` : undefined)
  const ogUrl = effectiveDomain ? `https://${effectiveDomain}/vacature/${slug}` : undefined
  const isExpired = job.end_date && new Date(job.end_date) < new Date()

  // Per-vacature header image overruled tenant fallback for social cards.
  const ogImages = job.header_image_url
    ? [{ url: job.header_image_url, width: 1600, height: 900 }]
    : tenant.og_image_url
      ? [{ url: tenant.og_image_url }]
      : undefined

  return {
    title,
    description,
    robots: isExpired ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      type: 'article',
      url: ogUrl,
      publishedTime: job.published_at || undefined,
      siteName: tenant.name,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages?.map((i) => i.url),
    },
    alternates: canonicalUrl ? {
      canonical: canonicalUrl,
      types: {
        'text/markdown': `${canonicalUrl}/md`,
      },
    } : undefined,
  }
}

export default async function JobPage({ params }: JobPageProps) {
  const { slug } = await params
  const tenant = await getTenant()

  if (!tenant) {
    notFound()
  }

  // Master aggregator heeft geen eigen vacature detail pages — redirect naar primary platform
  if (tenant.tier === 'master') {
    const masterJob = await getMasterJobBySlug(slug)
    if (!masterJob) notFound()
    const primaryDomain = masterJob.primary_platform?.domain ?? masterJob.primary_platform?.preview_domain
    if (!primaryDomain) notFound()
    redirect(`https://${primaryDomain}/vacature/${slug}`)
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

  const cleanDescription = ((job.content_md || job.description || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()) || `${job.title} bij ${companyName}`

  const validThrough = job.end_date
    ? new Date(job.end_date).toISOString()
    : job.published_at
      ? new Date(new Date(job.published_at).getTime() + 60 * 86400000).toISOString()
      : new Date(Date.now() + 30 * 86400000).toISOString()

  // --- Build BreadcrumbList JSON-LD (3-level: Home > City > Job) ---
  const effectiveDomain = tenant.domain ?? tenant.preview_domain
  const baseUrl = effectiveDomain ? `https://${effectiveDomain}` : ''
  const citySlug = job.city ? slugifyCity(job.city) : null
  const breadcrumbItems = baseUrl ? [
    { name: tenant.name, url: `${baseUrl}/` },
    ...(citySlug && job.city
      ? [{ name: `Vacatures in ${job.city}`, url: `${baseUrl}/vacatures/${citySlug}` }]
      : []),
    { name: job.title, url: `${baseUrl}/vacature/${slug}` },
  ] : []
  const breadcrumbJsonLd = buildBreadcrumbSchema(breadcrumbItems)

  const jsonLd = {
    ...buildJobPostingSchema({
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
    }),
    ...(job.header_image_url ? { image: job.header_image_url } : {}),
  }

  // Build wegwijzer items — only include non-null facts (conditioneel renderen)
  const postedAgo = job.published_at ? formatRelative(job.published_at) : null
  const endsInDays = job.end_date ? daysBetween(new Date(), new Date(job.end_date)) : null

  const wegwijzerItems: import('@/components/wegwijzer').WegwijzerItem[] = []
  if (job.city) {
    wegwijzerItems.push({
      id: 'city',
      label: job.city,
      icon: 'map',
      href: citySlug ? `/vacatures/${citySlug}` : undefined,
    })
  }
  if (postedAgo) {
    wegwijzerItems.push({ id: 'time', label: postedAgo, icon: 'clock' })
  }
  if (endsInDays !== null && endsInDays > 0 && endsInDays <= 30) {
    wegwijzerItems.push({ id: 'ends', label: `Nog ${endsInDays} dagen open`, icon: 'none' })
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <TenantHeader tenant={tenant} showSearch={false} />

      {/* Wegwijzer strip — signature breadcrumb + position markers */}
      <Wegwijzer
        back={{ label: 'Overzicht', href: '/' }}
        items={wegwijzerItems}
      />

      {/* Save action row — small affordance under wegwijzer */}
      <div className="bg-surface" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-end h-11 px-4 lg:px-6">
          <Suspense fallback={<div className="h-10 w-10" />}>
            <SaveJobButtonServer jobId={job.id} />
          </Suspense>
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

        {/* Hero — real image when set, otherwise branded gradient (Fase 2 fallback) */}
        {job.header_image_url ? (
          <div className="relative w-full aspect-[16/9] mb-6 overflow-hidden rounded-lg">
            <Image
              src={job.header_image_url}
              alt={job.title}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
            />
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="relative w-full aspect-[21/9] mb-6 overflow-hidden rounded-lg"
            style={{
              background:
                'linear-gradient(180deg, transparent 60%, rgba(26,24,21,0.25) 100%), linear-gradient(135deg, var(--primary) 0%, var(--secondary, var(--primary-dark)) 100%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.10) 0%, transparent 35%), repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0 20px, transparent 20px 40px)',
              }}
            />
          </div>
        )}

        <JobDetail job={job} relatedJobs={relatedJobs} />

        {/* Share buttons below job detail */}
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <ShareButtons url={baseUrl ? `${baseUrl}/vacature/${slug}` : `/vacature/${slug}`} title={job.title} />
        </div>
      </main>

      <Footer tenant={tenant} />

      {/* Sticky apply button (mobile bottom, desktop inline is in JobDetail) */}
      <ApplyButton
        jobUrl={job.url}
        jobId={job.id}
        jobTitle={job.title}
        isExpired={!!isExpired}
      />
    </div>
  )
}

/** Server wrapper that checks saved state before rendering client button */
async function SaveJobButtonServer({ jobId }: { jobId: string }) {
  const initialSaved = await isJobSaved(jobId)
  return <SaveJobButton jobId={jobId} initialSaved={initialSaved} />
}

/** Days between two dates (returns ceiled positive integer). */
function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.ceil(ms / 86_400_000)
}

