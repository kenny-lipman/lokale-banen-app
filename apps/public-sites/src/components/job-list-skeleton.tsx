/**
 * Skeleton loading state for the job list.
 * Matches the compact layout: list items on desktop, full-width on mobile.
 */
export function JobListSkeleton() {
  return (
    <div>
      {/* Result count skeleton */}
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="h-[18px] w-28 rounded bg-background animate-pulse" />
      </div>

      {/* Desktop: list item skeletons */}
      <div className="hidden lg:block">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="h-[22px] w-3/4 rounded bg-background animate-pulse mb-1" />
            <div className="h-[20px] w-1/2 rounded bg-background animate-pulse mb-1" />
            <div className="h-[18px] w-24 rounded bg-background animate-pulse mb-1" />
            <div className="h-[18px] w-full rounded bg-background animate-pulse" />
          </div>
        ))}
      </div>

      {/* Mobile: card skeletons */}
      <div className="lg:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <div className="h-[22px] w-3/4 rounded bg-background animate-pulse mb-1" />
            <div className="h-[20px] w-1/2 rounded bg-background animate-pulse mb-1.5" />
            <div className="h-[20px] w-28 rounded bg-background animate-pulse mb-1.5" />
            <div className="h-[20px] w-full rounded bg-background animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
