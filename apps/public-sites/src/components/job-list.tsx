import { Suspense } from 'react'
import { getApprovedJobs, type JobFilter } from '@/lib/queries'
import { JobCard } from './job-card'
import { JobListSkeleton } from './job-list-skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface JobListProps {
  tenantId: string
  filter: JobFilter
}

/**
 * Server component that fetches and renders the job list.
 * Wrapped in Suspense with skeleton fallback at the page level.
 */
export function JobList({ tenantId, filter }: JobListProps) {
  return (
    <Suspense fallback={<JobListSkeleton />}>
      <JobListContent tenantId={tenantId} filter={filter} />
    </Suspense>
  )
}

async function JobListContent({ tenantId, filter }: JobListProps) {
  // TODO: add 'use cache' + cacheLife + cacheTag after build verification

  const { jobs, total } = await getApprovedJobs(tenantId, filter)
  const currentPage = filter.page || 1
  const hasMore = currentPage * 20 < total

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-base mb-4">
          Geen vacatures gevonden voor deze zoekopdracht.
        </p>
        <Button variant="outline" asChild>
          <Link href="/">Filters resetten</Link>
        </Button>
      </div>
    )
  }

  // Build next page params
  const nextParams = new URLSearchParams()
  if (filter.query) nextParams.set('q', filter.query)
  if (filter.location) nextParams.set('location', filter.location)
  if (filter.type && filter.type !== 'alle') nextParams.set('type', filter.type)
  nextParams.set('page', String(currentPage + 1))

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {total} vacature{total !== 1 ? 's' : ''} gevonden
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" size="lg" asChild>
            <Link href={`/?${nextParams.toString()}`}>
              Meer vacatures
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
