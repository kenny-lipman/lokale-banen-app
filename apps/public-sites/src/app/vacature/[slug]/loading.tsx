export default function VacatureLoading() {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      {/* Header skeleton */}
      <div className="sticky top-0 z-40 bg-surface h-[48px] lg:h-[56px]" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          <div className="h-6 w-24 lg:h-8 lg:w-32 bg-muted/20 rounded animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <main className="flex-1 max-w-content mx-auto w-full py-6 px-4 lg:px-8">
        {/* Title */}
        <div className="h-7 w-3/4 bg-muted/20 rounded animate-pulse mb-2" />
        {/* Company + location */}
        <div className="h-5 w-1/2 bg-muted/20 rounded animate-pulse mb-4" />
        {/* Salary box */}
        <div className="h-20 w-full bg-muted/10 rounded-lg animate-pulse mb-4" />
        {/* CTA */}
        <div className="h-11 w-32 bg-muted/20 rounded-lg animate-pulse mb-6" />
        {/* Content lines */}
        <div className="space-y-3 mt-6">
          <div className="h-4 w-full bg-muted/15 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-muted/15 rounded animate-pulse" />
          <div className="h-4 w-4/6 bg-muted/15 rounded animate-pulse" />
          <div className="h-4 w-full bg-muted/15 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted/15 rounded animate-pulse" />
        </div>
      </main>
    </div>
  )
}
