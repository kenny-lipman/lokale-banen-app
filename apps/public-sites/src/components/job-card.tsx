import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { JobPosting } from '@/lib/queries'

interface JobCardProps {
  job: JobPosting
  /** Compact list-item style for split-view (no card border/shadow) */
  variant?: 'list' | 'mobile'
  /** Currently selected in split-view */
  isSelected?: boolean
  /** URL for the card link */
  href?: string
}

/**
 * Job card with two variants:
 * - "list": compact list item for desktop split-view
 * - "mobile": full card for mobile
 */
export function JobCard({
  job,
  variant = 'mobile',
  isSelected = false,
  href,
}: JobCardProps) {
  const companyName = job.company?.name || 'Onbekend bedrijf'
  const linkHref = href || `/vacature/${job.slug || job.id}`

  // Check if job is published within the last 3 days
  const isNew = job.published_at &&
    (Date.now() - new Date(job.published_at).getTime()) < 3 * 24 * 60 * 60 * 1000

  // Strip HTML for description preview
  const rawDesc = (job.description || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (variant === 'list') {
    return (
      <Link
        href={linkHref}
        className="group block relative cursor-pointer transition-colors duration-150"
        style={{
          padding: isSelected ? '14px 16px 14px 13px' : '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: isSelected ? 'var(--card-selected)' : undefined,
          borderLeft: isSelected ? '3px solid var(--primary)' : undefined,
        }}
        prefetch={false}
        data-selected={isSelected || undefined}
      >
        {/* Hover bg via group */}
        <div
          className="absolute inset-0 bg-card-hover opacity-0 group-hover:opacity-100 transition-opacity duration-150 -z-10"
          style={{ display: isSelected ? 'none' : undefined }}
        />

        {/* Title row with arrow */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-card-title text-foreground line-clamp-2">
            {job.title}
            {isNew && (
              <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded-full text-caption bg-amber-50 text-amber-800 border border-amber-200 align-middle">
                Nieuw
              </span>
            )}
          </h3>
          <ArrowRight
            className="shrink-0 h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-0.5"
            aria-hidden="true"
          />
        </div>

        {/* Company + Location — mt 2px */}
        <p className="mt-[2px]">
          <span className="text-body-medium text-foreground">{companyName}</span>
          {job.city && (
            <>
              <span className="text-muted"> &middot; </span>
              <span className="text-meta text-muted">{job.city}</span>
            </>
          )}
        </p>

        {/* Salary — mt 4px */}
        {job.salary && (
          <p className="text-salary text-salary mt-1">
            {job.salary}
          </p>
        )}

        {/* Description preview — mt 4px, single line ellipsis */}
        {rawDesc && (
          <p
            className="text-meta text-muted mt-1 overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {rawDesc}
          </p>
        )}
      </Link>
    )
  }

  // Mobile variant
  return (
    <Link
      href={linkHref}
      className="block"
      style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
      }}
      prefetch={false}
    >
      {/* Title: 16px/600 */}
      <h3 className="text-card-title text-foreground line-clamp-2">
        {job.title}
        {isNew && (
          <span className="inline-flex items-center ml-1.5 px-1.5 py-0.5 rounded-full text-caption bg-amber-50 text-amber-800 border border-amber-200 align-middle">
            Nieuw
          </span>
        )}
      </h3>

      {/* Company + Location — mt 4px */}
      <p className="mt-1">
        <span className="text-body-medium text-foreground">{companyName}</span>
        {job.city && (
          <>
            <span className="text-muted"> &middot; </span>
            <span className="text-body text-muted">{job.city}</span>
          </>
        )}
      </p>

      {/* Salary — 14px/600, mt 6px */}
      {job.salary && (
        <p className="text-[14px] font-semibold leading-5 text-salary mt-1.5">
          {job.salary}
        </p>
      )}

      {/* Description — 14px/400, max 2 lines, mt 6px */}
      {rawDesc && (
        <p className="text-body text-muted mt-1.5 line-clamp-2">
          {rawDesc}
        </p>
      )}
    </Link>
  )
}
