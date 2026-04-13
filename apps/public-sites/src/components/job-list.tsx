import { Suspense } from 'react'
import { getApprovedJobs, type JobFilter } from '@/lib/queries'
import { JobCard } from './job-card'
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
    return (
      <div className="text-center py-16 px-4">
        <p className="text-h2 text-foreground mb-1">Geen vacatures gevonden</p>
        <p className="text-body text-muted-foreground mb-4">
          Probeer andere zoektermen of filters.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-9 px-4 rounded-md border border-border text-body font-medium text-foreground transition-colors hover:bg-muted"
        >
          Alle vacatures bekijken
        </Link>
      </div>
    )
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
      <div className="px-4 py-2.5 border-b border-border">
        <p className="text-meta text-muted-foreground">
          {total} vacature{total !== 1 ? 's' : ''} gevonden
        </p>
      </div>

      {/* Desktop: list items for split-view, Mobile: card items */}
      {/* Desktop list items */}
      <div className="hidden lg:block">
        {jobs.map((job) => {
          // Build split-view URL: ?selected=slug (preserve other params)
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

      {/* Mobile card items */}
      <div className="lg:hidden grid gap-3 p-4">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} variant="card" />
        ))}
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className="flex justify-center py-4 px-4 border-t border-border">
          <Link
            href={`/?${nextParams.toString()}`}
            className="inline-flex items-center justify-center h-9 px-5 rounded-md border border-border text-body font-medium text-foreground transition-colors hover:bg-muted"
          >
            Meer vacatures
          </Link>
        </div>
      )}
    </div>
  )
}
