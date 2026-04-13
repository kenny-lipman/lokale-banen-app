import { Suspense } from 'react'
import { getApprovedJobs, type JobFilter } from '@/lib/queries'
import { JobCard } from './job-card'
import { NoResultsState } from './job-detail-panel'
import { JobListSkeleton } from './job-list-skeleton'
import Link from 'next/link'

interface JobListProps {
  tenantId: string
  filter: JobFilter
  /** Currently selected job slug (for split-view highlight) */
  selectedSlug?: string | null
}

/**
 * Server component that fetches and renders the job list.
 * Supports split-view mode: cards link to ?selected=slug on desktop.
 */
export function JobList({ tenantId, filter, selectedSlug }: JobListProps) {
  return (
    <Suspense fallback={<JobListSkeleton />}>
      <JobListContent tenantId={tenantId} filter={filter} selectedSlug={selectedSlug} />
    </Suspense>
  )
}

async function JobListContent({ tenantId, filter, selectedSlug }: JobListProps) {
  const { jobs, total } = await getApprovedJobs(tenantId, filter)
  const currentPage = filter.page || 1
  const hasMore = currentPage * 20 < total

  if (jobs.length === 0) {
    return <NoResultsState />
  }

  // Build base params for pagination links (preserve current search context)
  const baseParams = new URLSearchParams()
  if (filter.query) baseParams.set('q', filter.query)
  if (filter.location) baseParams.set('location', filter.location)
  if (filter.type && filter.type !== 'alle') baseParams.set('type', filter.type)

  // Build next page params
  const nextParams = new URLSearchParams(baseParams)
  nextParams.set('page', String(currentPage + 1))

  return (
    <div>
      {/* Result count */}
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <p className="text-meta text-muted">
          {total} vacature{total !== 1 ? 's' : ''} gevonden
        </p>
      </div>

      {/* Desktop: list items for split-view */}
      <div className="hidden lg:block">
        {jobs.map((job) => {
          const selectParams = new URLSearchParams(baseParams)
          selectParams.set('selected', job.slug || job.id)
          const selectHref = `/?${selectParams.toString()}`

          return (
            <JobCard
              key={job.id}
              job={job}
              variant="list"
              isSelected={selectedSlug === (job.slug || job.id)}
              href={selectHref}
            />
          )
        })}
      </div>

      {/* Mobile: full-width cards */}
      <div className="lg:hidden">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} variant="mobile" />
        ))}
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className="flex justify-center py-4 px-4" style={{ borderTop: '1px solid var(--border)' }}>
          <Link
            href={`/?${nextParams.toString()}`}
            className="inline-flex items-center justify-center h-9 px-5 rounded-lg text-button text-primary transition-colors hover:bg-primary-light"
            style={{ border: '1px solid var(--primary)' }}
          >
            Meer vacatures
          </Link>
        </div>
      )}
    </div>
  )
}
