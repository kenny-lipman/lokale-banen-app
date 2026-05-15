import { cn } from '@/lib/utils'

interface VacatureCardSkeletonProps {
  count?: number
}

/**
 * Loading skeleton in dezelfde grid-shape als VacatureCard. Gebruikt subtiele
 * shimmer-animatie binnen `divider-subtle`-tinten - gerespecteerd door
 * `prefers-reduced-motion` (animatie-duur op 0.01ms).
 */
export function VacatureCardSkeleton({ count = 1 }: VacatureCardSkeletonProps) {
  return (
    <div className="flex flex-col gap-s3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <article
          key={i}
          className="grid grid-cols-1 sm:grid-cols-[141px_1fr_168px] bg-surface min-h-[222px] shadow-card"
        >
          <div className="w-full h-[100px] sm:w-[141px] sm:h-[141px] bg-divider-subtle animate-pulse" />
          <div className="flex flex-col gap-3 px-5 sm:px-7 py-6">
            <Bar className="w-3/4 h-6" />
            <Bar className="w-1/2 h-4" />
            <Bar className="w-full h-3 mt-2" />
            <Bar className="w-5/6 h-3" />
            <Bar className="w-2/3 h-3" />
          </div>
          <div className="flex flex-col gap-2 px-5 sm:px-6 py-6">
            <Bar className="w-2/3 h-3" />
            <Bar className="w-1/2 h-3" />
            <Bar className="w-3/4 h-3" />
            <Bar className="w-2/3 h-3 mt-3" />
            <Bar className="w-1/2 h-3" />
          </div>
        </article>
      ))}
    </div>
  )
}

function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'block bg-divider-subtle animate-pulse',
        className
      )}
    />
  )
}
