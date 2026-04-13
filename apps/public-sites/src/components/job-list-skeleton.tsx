import { Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton loading state for the job list.
 * Matches the new compact layout: list items on desktop, cards on mobile.
 */
export function JobListSkeleton() {
  return (
    <div>
      {/* Result count skeleton */}
      <div className="px-4 py-2.5 border-b border-border">
        <Skeleton className="h-3 w-28" />
      </div>

      {/* Desktop: list item skeletons */}
      <div className="hidden lg:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-border">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-2" />
            <Skeleton className="h-3 w-32 mb-1.5" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>

      {/* Mobile: card skeletons */}
      <div className="lg:hidden grid gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-2" />
            <Skeleton className="h-3 w-32 mb-1.5" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
