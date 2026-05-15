import { Suspense } from 'react'
import { getApprovedJobs, type JobFilter, type JobPosting } from '@/lib/queries'
import { haversineKm } from '@/lib/utils'
import { VacatureCard } from './vacature-card'
import { VacatureCardSkeleton } from './vacature-card-skeleton'
import { EmptyState } from './empty-state'
import { PillButton } from './pill-button'

interface JobListProps {
  tenantId: string
  filter: JobFilter
}

const PAGE_SIZE = 20

/**
 * Server-component die vacatures fetcht en als VacatureCard-grid rendert.
 * Suspense-boundary toont VacatureCardSkeleton tijdens het wachten.
 *
 * Geen sort/filter UI hier - die leeft op page-niveau (zie SortToolbar in
 * fase 5 + page.tsx in fase 6).
 */
export function JobList({ tenantId, filter }: JobListProps) {
  return (
    <Suspense fallback={<VacatureCardSkeleton count={4} />}>
      <JobListContent tenantId={tenantId} filter={filter} />
    </Suspense>
  )
}

async function JobListContent({ tenantId, filter }: JobListProps) {
  const { jobs: rawJobs, total } = await getApprovedJobs(tenantId, filter)
  const currentPage = filter.page || 1
  const hasMore = currentPage * PAGE_SIZE < total
  const hasLocation = filter.userLat != null && filter.userLng != null

  // Client-side sort op afstand wanneer ?sort=nearest + locatie beschikbaar.
  const jobs =
    filter.sort === 'nearest' && hasLocation
      ? [...rawJobs].sort((a, b) => {
          const da = jobDistanceKm(a, filter.userLat, filter.userLng)
          const db = jobDistanceKm(b, filter.userLat, filter.userLng)
          if (da == null && db == null) return 0
          if (da == null) return 1
          if (db == null) return -1
          return da - db
        })
      : rawJobs

  if (jobs.length === 0) {
    return <EmptyState />
  }

  // "Nog X vacatures tonen" link met behoud van bestaande filter-context
  const nextParams = buildNextPageParams(filter, currentPage + 1)

  return (
    <div>
      <div className="flex flex-col gap-s3">
        {jobs.map((job) => (
          <VacatureCard
            key={job.id}
            job={job}
            distanceKm={jobDistanceKm(job, filter.userLat, filter.userLng)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-7 pb-14">
          <PillButton href={`/?${nextParams.toString()}`}>
            Nog {Math.max(0, total - currentPage * PAGE_SIZE).toLocaleString('nl-NL')} vacatures tonen
            <ArrowDownIcon />
          </PillButton>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jobDistanceKm(
  job: JobPosting,
  userLat: number | undefined,
  userLng: number | undefined
): number | null {
  if (userLat == null || userLng == null) return null
  const lat = job.latitude ? parseFloat(job.latitude) : (job.company?.latitude ?? null)
  const lng = job.longitude ? parseFloat(job.longitude) : (job.company?.longitude ?? null)
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null
  return haversineKm(userLat, userLng, lat, lng)
}

function buildNextPageParams(filter: JobFilter, page: number): URLSearchParams {
  const p = new URLSearchParams()
  if (filter.query) p.set('q', filter.query)
  if (filter.location) p.set('location', filter.location)
  if (filter.type) p.set('type', filter.type)
  if (filter.hours) p.set('hours', filter.hours)
  if (filter.education?.length) p.set('education', filter.education.join(','))
  if (filter.sector?.length) p.set('sector', filter.sector.join(','))
  if (filter.sort && filter.sort !== 'newest') p.set('sort', filter.sort)
  if (filter.userLat != null) p.set('lat', String(filter.userLat))
  if (filter.userLng != null) p.set('lng', String(filter.userLng))
  p.set('page', String(page))
  return p
}

function ArrowDownIcon() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-secondary shrink-0"
      aria-hidden="true"
    >
      <path d="M18.7071 8.29289C19.0976 8.68342 19.0976 9.31658 18.7071 9.70711L12.7071 15.7071C12.3166 16.0976 11.6834 16.0976 11.2929 15.7071L5.29289 9.70711C4.90237 9.31658 4.90237 8.68342 5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L12 13.5858L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289Z" />
    </svg>
  )
}
