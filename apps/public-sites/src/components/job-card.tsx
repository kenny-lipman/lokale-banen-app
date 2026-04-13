import Link from 'next/link'
import { cn, formatRelative, formatEmploymentLabel } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'

interface JobCardProps {
  job: JobPosting
  /** Compact list-item style for split-view (no card border/shadow) */
  variant?: 'list' | 'card'
  /** Currently selected in split-view */
  isSelected?: boolean
  /** URL for the card link */
  href?: string
}

/**
 * Job card with two variants:
 * - "list": compact list item for desktop split-view (no border/shadow, divider between items)
 * - "card": full card for mobile (subtle border, rounded)
 *
 * No company logo/avatar in either variant to avoid layout shift.
 */
export function JobCard({
  job,
  variant = 'card',
  isSelected = false,
  href,
}: JobCardProps) {
  const isNew =
    job.published_at &&
    Date.now() - new Date(job.published_at).getTime() < 3 * 24 * 60 * 60 * 1000

  const companyName = job.company?.name || 'Onbekend bedrijf'
  const employmentLabel = formatEmploymentLabel(job.employment, job.job_type)
  const linkHref = href || `/vacature/${job.slug || job.id}`

  if (variant === 'list') {
    return (
      <Link
        href={linkHref}
        className={cn(
          'block px-4 py-3 border-b border-border transition-colors',
          isSelected
            ? 'bg-primary/5 border-l-[3px] border-l-primary'
            : 'hover:bg-muted/50 border-l-[3px] border-l-transparent'
        )}
        prefetch={false}
      >
        {/* Title + New badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn(
            'text-[14px] font-semibold leading-tight line-clamp-2',
            isSelected ? 'text-primary' : 'text-foreground'
          )}>
            {job.title}
          </h3>
          {isNew && (
            <span className="shrink-0 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Nieuw
            </span>
          )}
        </div>

        {/* Company + Location */}
        <p className="text-[13px] text-muted-foreground mt-1">
          {companyName}
          {job.city && <span> &middot; {job.city}</span>}
        </p>

        {/* Salary + Employment */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {job.salary && (
            <span className="text-[13px] font-semibold text-salary tabular-nums">
              {job.salary}
            </span>
          )}
          {job.salary && employmentLabel && (
            <span className="text-muted-foreground">&middot;</span>
          )}
          {employmentLabel && (
            <span className="text-[13px] text-muted-foreground">{employmentLabel}</span>
          )}
        </div>

        {/* Time ago */}
        {job.published_at && (
          <p className="text-meta text-muted-foreground mt-1.5">
            {formatRelative(job.published_at)}
          </p>
        )}
      </Link>
    )
  }

  // Card variant (mobile)
  return (
    <Link
      href={linkHref}
      className="block group"
      prefetch={false}
    >
      <div className="rounded-md border border-border bg-card p-4 transition-colors group-hover:border-muted-foreground/20">
        {/* Title + New badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[14px] font-semibold leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {job.title}
          </h3>
          {isNew && (
            <span className="shrink-0 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
              Nieuw
            </span>
          )}
        </div>

        {/* Company + Location */}
        <p className="text-[13px] text-muted-foreground mt-1">
          {companyName}
          {job.city && <span> &middot; {job.city}</span>}
        </p>

        {/* Salary + Employment */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {job.salary && (
            <span className="text-[13px] font-semibold text-salary tabular-nums">
              {job.salary}
            </span>
          )}
          {job.salary && employmentLabel && (
            <span className="text-muted-foreground">&middot;</span>
          )}
          {employmentLabel && (
            <span className="text-[13px] text-muted-foreground">{employmentLabel}</span>
          )}
        </div>

        {/* Time ago */}
        {job.published_at && (
          <p className="text-meta text-muted-foreground mt-1.5">
            {formatRelative(job.published_at)}
          </p>
        )}
      </div>
    </Link>
  )
}
