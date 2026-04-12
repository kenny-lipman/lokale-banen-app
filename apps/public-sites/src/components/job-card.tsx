import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MapPin } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'

interface JobCardProps {
  job: JobPosting
}

/**
 * Full job card implementation following DESIGN.md section 10.
 * Entire card is a link (large tap target). Hover lifts with shadow.
 * Company avatar with fallback initials, salary highlight, "Nieuw" badge.
 */
export function JobCard({ job }: JobCardProps) {
  const isNew =
    job.published_at &&
    Date.now() - new Date(job.published_at).getTime() < 3 * 24 * 60 * 60 * 1000

  const companyName = job.company?.name || job.company_name || 'Onbekend bedrijf'
  const companyInitials = companyName.slice(0, 2).toUpperCase()
  const logoUrl = job.company?.logo_url

  return (
    <Link
      href={`/vacature/${job.slug || job.id}`}
      className="block group"
      prefetch={false}
    >
      <Card className="transition-all hover:shadow-md hover:border-border">
        <CardContent className="p-5 sm:p-6">
          <div className="flex gap-4">
            {/* Company avatar */}
            <div className="h-12 w-12 rounded-md shrink-0 overflow-hidden bg-muted flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={companyName}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">
                  {companyInitials}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Title + Nieuw badge */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-h3 leading-tight tracking-tight group-hover:text-primary transition-colors line-clamp-2">
                  {job.title}
                </h3>
                {isNew && (
                  <Badge variant="new" className="shrink-0">
                    Nieuw
                  </Badge>
                )}
              </div>

              {/* Company + location */}
              <p className="text-meta text-muted-foreground mt-1 flex items-center gap-1">
                <span className="font-medium">{companyName}</span>
                {job.city && (
                  <>
                    <span aria-hidden="true">·</span>
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{job.city}</span>
                  </>
                )}
              </p>

              {/* Salary */}
              {job.salary && (
                <p className="text-sm font-semibold text-emerald-700 mt-2 tabular-nums">
                  {job.salary}
                </p>
              )}

              {/* Meta: employment type + time */}
              <div className="flex items-center gap-2 mt-3 text-meta text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{job.employment_type || 'Onbekend'}</span>
                {job.published_at && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelative(job.published_at)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
