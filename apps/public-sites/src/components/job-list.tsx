import { Suspense } from 'react'
import { getApprovedJobs, type JobFilter } from '@/lib/queries'
import { EditorialJobCard } from './editorial-job-card'
import { NoResultsState } from './job-detail-panel'
import { JobListSkeleton } from './job-list-skeleton'
import { SortSelect } from './sort-select'
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
  if (filter.sort && filter.sort !== 'newest') baseParams.set('sort', filter.sort)

  // Build next page params
  const nextParams = new URLSearchParams(baseParams)
  nextParams.set('page', String(currentPage + 1))

  return (
    <div>
      {/* Result count + sort */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <p className="text-body-medium text-muted">
          {total} vacature{total !== 1 ? 's' : ''} gevonden
        </p>
        <SortSelect current={filter.sort || 'newest'} />
      </div>

      {/* Desktop: list items for split-view */}
      <div className="hidden lg:flex flex-col gap-2 px-4 lg:px-6 py-4">
        {jobs.map((job) => {
          const selectParams = new URLSearchParams(baseParams)
          selectParams.set('selected', job.slug || job.id)
          const selectHref = `/?${selectParams.toString()}`

          return (
            <EditorialJobCard
              key={job.id}
              job={job}
              variant="list"
              isActive={selectedSlug === (job.slug || job.id)}
              href={selectHref}
            />
          )
        })}
      </div>

      {/* Mobile: full-width cards */}
      <div className="lg:hidden flex flex-col gap-2 px-4 py-4">
        {jobs.map((job) => (
          <EditorialJobCard key={job.id} job={job} variant="mobile" />
        ))}
      </div>

      {/* Load more — accumulating pagination, SEO-friendly via real URL */}
      {hasMore && (
        <div
          className="flex flex-col items-center gap-2 py-6 px-4"
          style={{ borderTop: '1px dashed var(--border)' }}
        >
          <Link
            href={`/?${nextParams.toString()}`}
            className="inline-flex items-center gap-2 rounded-full transition-all"
            style={{
              padding: '11px 22px',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'var(--text)',
            }}
          >
            Nog {Math.max(0, total - currentPage * 20).toLocaleString('nl-NL')} vacatures tonen
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </Link>
          <p
            className="font-mono"
            style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
          >
            Volledige lijst doorzoekbaar voor zoekmachines
          </p>
        </div>
      )}
    </div>
  )
}
