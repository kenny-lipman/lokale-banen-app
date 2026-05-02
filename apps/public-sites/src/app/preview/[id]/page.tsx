/**
 * Draft preview route voor pending/unpublished vacatures.
 *
 * Alleen toegankelijk via HMAC-signed URLs gegenereerd door de admin-app.
 * Token verloopt na 1 uur. Altijd noindex/nofollow.
 */

import Image from 'next/image'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { getTenantById, getTenantByHostForPreview } from '@/lib/tenant'
import { getJobByIdForPreview, getCitiesWithJobCounts } from '@/lib/queries'
import { verifyPreviewToken } from '@lokale-banen/shared'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  JobDetail,
  ApplyButton,
} from '@/components/eyeron'

interface PreviewPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string; platform?: string }>
}

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  title: 'Draft Preview',
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { id } = await params
  const { token, platform } = await searchParams

  if (!token || !verifyPreviewToken(id, token)) notFound()

  // Tenant resolution voor preview (service role, bypasst RLS):
  //   1. ?platform= → lookup by ID
  //   2. anders → lookup by host (werkt voor freshly provisioned platforms
  //      met preview_domain set)
  let tenant = platform ? await getTenantById(platform) : null
  if (!tenant) {
    const host = (await headers()).get('x-tenant-host')
    if (host) tenant = await getTenantByHostForPreview(host)
  }
  if (!tenant) notFound()

  const job = await getJobByIdForPreview(id)
  if (!job) notFound()

  const isExpired = !!(job.end_date && new Date(job.end_date) < new Date())
  const cities = await getCitiesWithJobCounts(tenant.id)

  const statusLabel = job.published_at
    ? 'Live op publieke site'
    : job.review_status === 'approved'
    ? 'Goedgekeurd, nog niet gepubliceerd'
    : job.review_status === 'rejected'
    ? 'Afgekeurd / gearchiveerd'
    : 'In review (pending)'

  return (
    <div className="flex flex-col min-h-screen">
      {/* DRAFT PREVIEW banner — sticky boven de header, onmiskenbaar */}
      <div
        role="alert"
        className="sticky top-0 z-50 bg-amber-500 text-black"
      >
        <div className="max-w-content mx-auto px-pad py-2.5 flex items-center gap-3 text-meta">
          <AlertTriangle
            className="h-4 w-4 shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="flex-1">
            <strong className="font-bold">DRAFT PREVIEW</strong> — Voorbeeld voor
            admins. Status: {statusLabel}. Niet zichtbaar voor bezoekers.
          </span>
          <span className="text-small font-light hidden sm:inline opacity-75">
            Preview-link verloopt na 1 uur
          </span>
        </div>
      </div>

      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8 pb-24 sm:pb-8">
        <Breadcrumbs
          className="mb-6"
          items={[
            { label: tenant.name, href: '/' },
            { label: 'Draft preview' },
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

        <JobDetail
          job={job}
          relatedJobs={[]}
          pageUrl={`/preview/${id}?token=${token}`}
        />
      </main>

      <SiteFooter tenant={tenant} cities={cities} />

      <ApplyButton
        jobUrl={job.url}
        jobId={job.id}
        jobTitle={job.title}
        isExpired={isExpired}
      />
    </div>
  )
}
