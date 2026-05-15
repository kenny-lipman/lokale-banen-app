import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getTenant } from '@/lib/tenant'
import {
  getJobBySlug,
  getMasterJobBySlug,
  getRelatedJobs,
  parseSalary,
  mapEmploymentType,
  getCitiesWithJobCounts,
} from '@/lib/queries'
import { getCanonicalInfo } from '@/lib/canonical'
import { buildJobPostingSchema, buildBreadcrumbSchema } from '@lokale-banen/shared'
import { slugifyCity } from '@lokale-banen/database'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  JobDetail,
  ApplyButton,
} from '@/components/eyeron'

interface JobPageProps {
  params: Promise<{ slug: string }>
}

/** Grace-window: gearchiveerde detail-pagina blijft 30 dagen bereikbaar
 *  met noindex + "afgelopen"-bordje voordat hij 404 gaat. */
const ARCHIVE_GRACE_MS = 30 * 86_400_000

export async function generateMetadata({ params }: JobPageProps): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant()
  if (!tenant) return {}

  const job = await getJobBySlug(tenant.id, slug)
  if (!job) return {}

  const companyName = job.company?.name || ''
  const tenantTitle = tenant.hero_title || tenant.name
  const title =
    job.seo_title ||
    (companyName
      ? `${job.title} bij ${companyName} | ${tenantTitle}`
      : `${job.title} | ${tenantTitle}`)

  const rawText = (job.seo_description || job.description || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const description =
    rawText.length > 160
      ? rawText.slice(0, 157) + '...'
      : rawText || `Bekijk de vacature ${job.title} bij ${companyName}`

  const canonical = await getCanonicalInfo(job.id, slug)
  const effectiveDomain = tenant.domain ?? tenant.preview_domain
  const canonicalUrl =
    canonical?.canonicalUrl ??
    (effectiveDomain ? `https://${effectiveDomain}/vacature/${slug}` : undefined)
  const ogUrl = effectiveDomain ? `https://${effectiveDomain}/vacature/${slug}` : undefined
  const isExpired = !!(job.end_date && new Date(job.end_date) < new Date())
  const isArchived = !!job.archived_at
  const archivedNoindex =
    isArchived &&
    new Date(job.archived_at!).getTime() > Date.now() - ARCHIVE_GRACE_MS

  const headerImage = job.header_image_url?.trim() || null
  const ogImages = headerImage
    ? [{ url: headerImage, width: 1600, height: 900 }]
    : tenant.og_image_url
    ? [{ url: tenant.og_image_url }]
    : undefined

  return {
    title,
    description,
    robots: isExpired || archivedNoindex ? { index: false, follow: false } : undefined,
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
    alternates: canonicalUrl
      ? {
          canonical: canonicalUrl,
          types: { 'text/markdown': `${canonicalUrl}/md` },
        }
      : undefined,
  }
}

export default async function JobPage({ params }: JobPageProps) {
  const { slug } = await params
  const tenant = await getTenant()
  if (!tenant) notFound()

  // Master aggregator → redirect naar primary platform domain.
  if (tenant.tier === 'master') {
    const masterJob = await getMasterJobBySlug(slug)
    if (!masterJob) notFound()
    // Permanent gone (>30d archived) → 404 ipv 301 → 404 round-trip via regio-host.
    // 0-30d grace: laat redirect doorgaan zodat regio-host het amber-bordje toont.
    const masterArchivedAt = masterJob.archived_at ? new Date(masterJob.archived_at) : null
    const masterArchiveAge = masterArchivedAt ? Date.now() - masterArchivedAt.getTime() : 0
    if (masterArchivedAt && masterArchiveAge >= ARCHIVE_GRACE_MS) {
      notFound()
    }
    const primaryDomain =
      masterJob.primary_platform?.domain ?? masterJob.primary_platform?.preview_domain
    if (!primaryDomain) notFound()
    redirect(`https://${primaryDomain}/vacature/${slug}`)
  }

  const job = await getJobBySlug(tenant.id, slug)
  if (!job) notFound()

  // Drie-staten archief: actief / grace 30d / permanent gone
  const archivedAt = job.archived_at ? new Date(job.archived_at) : null
  const archiveAgeMs = archivedAt ? Date.now() - archivedAt.getTime() : 0
  const isInGrace = archivedAt && archiveAgeMs < ARCHIVE_GRACE_MS
  const isPermanentlyGone = archivedAt && !isInGrace

  // Permanent gone - Next.js heeft geen native 410, dus 404 (Google
  // de-indexeert beide statussen).
  if (isPermanentlyGone) notFound()

  const isExpired = !!(job.end_date && new Date(job.end_date) < new Date())

  const [relatedJobs, cities] = await Promise.all([
    getRelatedJobs(tenant.id, job.city, job.id),
    getCitiesWithJobCounts(tenant.id),
  ])

  const companyName = job.company?.name || 'Onbekend bedrijf'
  const salary = parseSalary(job.salary)
  const employmentType = mapEmploymentType(job.employment)

  const sameAs: string[] = []
  if (job.company?.website) sameAs.push(job.company.website)
  if (job.company?.linkedin_url) sameAs.push(job.company.linkedin_url)

  const lat = job.latitude ? parseFloat(job.latitude) : (job.company?.latitude ?? null)
  const lng = job.longitude ? parseFloat(job.longitude) : (job.company?.longitude ?? null)

  const cleanDescription =
    (job.content_md || job.description || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim() || `${job.title} bij ${companyName}`

  const validThrough = job.end_date
    ? new Date(job.end_date).toISOString()
    : job.published_at
    ? new Date(new Date(job.published_at).getTime() + 60 * 86_400_000).toISOString()
    : new Date(Date.now() + 30 * 86_400_000).toISOString()

  const effectiveDomain = tenant.domain ?? tenant.preview_domain
  const baseUrl = effectiveDomain ? `https://${effectiveDomain}` : ''
  const citySlug = job.city ? slugifyCity(job.city) : null
  const breadcrumbItems = baseUrl
    ? [
        { name: tenant.name, url: `${baseUrl}/` },
        ...(citySlug && job.city
          ? [{ name: `Vacatures in ${job.city}`, url: `${baseUrl}/vacatures/${citySlug}` }]
          : []),
        { name: job.title, url: `${baseUrl}/vacature/${slug}` },
      ]
    : []
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
        latitude: lat && !isNaN(lat) ? lat : null,
        longitude: lng && !isNaN(lng) ? lng : null,
      },
      salary: salary
        ? { minValue: salary.min, maxValue: salary.max, currency: 'EUR', unitText: salary.unit }
        : null,
      directApply: !job.url,
      identifier: { name: tenant.name, value: job.id },
      applicantLocationCountry: 'NL',
    }),
    ...(job.header_image_url?.trim() ? { image: job.header_image_url.trim() } : {}),
  }

  const pageUrl = baseUrl ? `${baseUrl}/vacature/${slug}` : `/vacature/${slug}`

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8 pb-24 lg:pb-8">
        {isInGrace && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <h2 className="text-lg font-semibold">Deze vacature is afgelopen</h2>
            <p className="mt-1 text-sm text-amber-800">
              Deze positie is niet meer beschikbaar. Bekijk{' '}
              <a href="/vacatures" className="underline">andere vacatures</a>.
            </p>
          </div>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
          }}
        />

        <Breadcrumbs
          className="mb-6"
          items={[
            { label: tenant.name, href: '/' },
            ...(citySlug && job.city
              ? [{ label: `Vacatures in ${job.city}`, href: `/vacatures/${citySlug}` }]
              : []),
            { label: job.title },
          ]}
        />

        {job.header_image_url?.trim() && (
          <div className="relative w-full aspect-[16/9] mb-8 overflow-hidden">
            <Image
              src={job.header_image_url.trim()}
              alt={job.title}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              className="object-cover"
            />
          </div>
        )}

        <JobDetail job={job} relatedJobs={relatedJobs} pageUrl={pageUrl} />
      </main>

      <SiteFooter tenant={tenant} cities={cities} />

      {/* Sticky bottom apply CTA - mobile + tablet (sidebar heeft eigen CTA op desktop) */}
      <ApplyButton
        jobUrl={job.url}
        jobId={job.id}
        jobTitle={job.title}
        isExpired={isExpired}
      />
    </div>
  )
}
