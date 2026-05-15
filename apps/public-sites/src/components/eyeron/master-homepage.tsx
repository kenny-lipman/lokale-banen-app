import Link from 'next/link'
import type { Tenant } from '@/lib/tenant'
import type { MasterJobPosting, PlatformSummary } from '@/lib/queries'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { SiteHeader } from './site-header'
import { SiteFooter } from './site-footer'
import { VacatureCard } from './vacature-card'
import { PillButton } from './pill-button'
import { ArrowRight } from './arrow-right'

interface MasterHomepageProps {
  tenant: Tenant
  platforms: PlatformSummary[]
  recentJobs: MasterJobPosting[]
  totalJobs: number
}

/**
 * Master aggregator (lokalebanen.nl) in Eyeron-stijl.
 *
 * Layout:
 *   1. SiteHeader (zelfde chrome als regio-portals, eigen LokaleBanen-palet)
 *   2. Hero - primary banner met netwerk-counts
 *   3. Regio-grid (4-koloms tegels)
 *   4. Recente vacatures grid
 *   5. SiteFooter (master krijgt geen master-logo onder zichzelf)
 */
export async function MasterHomepage({
  tenant,
  platforms,
  recentJobs,
  totalJobs,
}: MasterHomepageProps) {
  const cities = await getCitiesWithJobCounts(tenant.id)

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1">
        <section className="bg-primary text-on-dark">
          <div className="max-w-content mx-auto px-pad py-14">
            <h1 className="text-h1 font-regular text-on-dark leading-tight m-0">
              Lokale vacatures door{' '}
              <em className="not-italic text-secondary">heel Nederland</em>
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-meta font-light">
              <span className="inline-flex items-center h-9 px-4 rounded-pill border border-on-dark text-on-dark">
                {totalJobs.toLocaleString('nl-NL')} open posities
              </span>
              <span className="text-on-dark/85">
                {platforms.length} regionale platforms
              </span>
            </div>
          </div>
        </section>

        <section className="max-w-content mx-auto w-full px-pad py-12">
          <h2 className="text-h2 font-bold text-primary tracking-tight m-0 mb-6">
            Vind jouw regio
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {platforms.map((platform) => (
              <PlatformTile key={platform.id} platform={platform} />
            ))}
          </div>
        </section>

        <section className="max-w-content mx-auto w-full px-pad pb-14">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-h2 font-bold text-primary tracking-tight m-0">
              Recente vacatures
            </h2>
            <Link
              href="/vacatures"
              className="text-meta font-regular text-secondary hover:text-secondary-hover hover:underline underline-offset-2 inline-flex items-center gap-2"
            >
              Bekijk alle vacatures
              <ArrowRight width={13} height={8} />
            </Link>
          </div>
          <div className="grid gap-[18px]">
            {recentJobs.map((job) => (
              <VacatureCard key={job.id} job={job} />
            ))}
          </div>
          <div className="flex justify-center mt-8">
            <PillButton href="/vacatures">
              Alle vacatures bekijken
              <ArrowRight />
            </PillButton>
          </div>
        </section>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

function PlatformTile({ platform }: { platform: PlatformSummary }) {
  const url = platform.domain
    ? `https://${platform.domain}`
    : platform.preview_domain
    ? `https://${platform.preview_domain}`
    : '#'

  return (
    <a
      href={url}
      className="group block bg-surface p-5 transition-shadow hover:shadow-card-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
    >
      <h3 className="text-body font-bold text-primary tracking-tight m-0 group-hover:text-primary-hover">
        {platform.name}
      </h3>
      {platform.central_place && (
        <p className="m-0 mt-1 text-meta font-light text-body">
          {platform.central_place}
        </p>
      )}
      <p className="m-0 mt-2 text-meta font-light text-body">
        {platform.job_count.toLocaleString('nl-NL')} vacatures
      </p>
    </a>
  )
}
