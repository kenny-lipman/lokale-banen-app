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
    const primaryDomain =
      masterJob.primary_platform?.domain ?? masterJob.primary_platform?.preview_domain
    if (!primaryDomain) notFound()
    redirect(`https://${primaryDomain}/vacature/${slug}`)
  }

  const job = await getJobBySlug(tenant.id, slug)
  if (!job) notFound()

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
    ...(job.header_image_url ? { image: job.header_image_url } : {}),
  }

  const pageUrl = baseUrl ? `${baseUrl}/vacature/${slug}` : `/vacature/${slug}`

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8 pb-24 sm:pb-8">
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

        {job.header_image_url && (
          <div className="relative w-full aspect-[16/9] mb-8 overflow-hidden">
            <Image
              src={job.header_image_url}
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

      {/* Sticky bottom apply CTA — alleen op mobile (sidebar heeft eigen CTA op desktop) */}
      <ApplyButton
        jobUrl={job.url}
        jobId={job.id}
        jobTitle={job.title}
        isExpired={isExpired}
      />
    </div>
  )
}
