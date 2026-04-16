import Link from 'next/link'
import { Bookmark, Briefcase, Clock, GraduationCap } from 'lucide-react'
import type { JobPosting } from '@/lib/queries'
import { CompanyLogo } from './company-logo'
import { DistanceChip } from './distance-chip'
import { formatEmploymentLabel } from '@/lib/utils'

/** Strip HTML tags and decode entities for plain-text excerpt. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

interface EditorialJobCardProps {
  job: JobPosting
  /** Layout variant — `list` for desktop split-view, `mobile` for stacked. */
  variant?: 'list' | 'mobile'
  /** Distance in km from user. When nullish the chip is hidden. */
  distanceKm?: number | null
  /** Currently selected in split-view — adds primary-tint background. */
  isActive?: boolean
  /** Optional href override. */
  href?: string
  /** Whether the job has been saved/bookmarked. */
  isSaved?: boolean
}

/**
 * Editorial job card — new design.
 *
 * Layout:
 *   ┌───────────────────────────────────────────┐
 *   │ [logo] Title              [bookmark]      │
 *   │        Company · City                     │
 *   │                                           │
 *   │ [0.8km] [City] [Nieuw]                   │
 *   │                                           │
 *   │ € 3.200 – 4.100 bruto p/m                │
 *   │ ─────────────────────────────             │
 *   │ ▸ Vast · ▸ 36 uur · ▸ HBO                │
 *   └───────────────────────────────────────────┘
 *
 * All sub-elements are conditional. Missing data (no salary, no facets, no
 * distance) simply removes the corresponding line rather than showing a
 * placeholder.
 */
export function EditorialJobCard({
  job,
  variant = 'list',
  distanceKm,
  isActive = false,
  href,
  isSaved = false,
}: EditorialJobCardProps) {
  const companyName = job.company?.name || 'Onbekend bedrijf'
  const linkHref = href || `/vacature/${job.slug || job.id}`

  const isNew =
    job.published_at &&
    Date.now() - new Date(job.published_at).getTime() < 3 * 24 * 60 * 60 * 1000

  // Extract facet badges from schema fields
  const facets: { icon: React.ReactNode; label: string }[] = []
  const employmentLabel = formatEmploymentLabel(job.employment, job.job_type)
  if (employmentLabel && employmentLabel !== 'Onbekend') {
    facets.push({
      icon: (
        <Briefcase size={13} strokeWidth={1.8} aria-hidden="true" />
      ),
      label: employmentLabel,
    })
  }
  const hoursLabel = formatHours(job.working_hours_min, job.working_hours_max)
  if (hoursLabel) {
    facets.push({
      icon: <Clock size={13} strokeWidth={1.8} aria-hidden="true" />,
      label: hoursLabel,
    })
  }
  if (job.education_level) {
    facets.push({
      icon: <GraduationCap size={13} strokeWidth={1.8} aria-hidden="true" />,
      label: job.education_level,
    })
  }

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    background: isActive ? 'var(--primary-tint)' : 'var(--surface)',
    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
    borderRadius: variant === 'mobile' ? 'var(--r-md)' : 'var(--r-lg)',
    padding: variant === 'mobile' ? '16px 16px 14px' : '18px 20px 16px',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }

  const hasSalary =
    job.salary && job.salary.trim() !== '-' && job.salary.trim() !== ''

  return (
    <Link
      href={linkHref}
      prefetch={false}
      className="group block"
      style={cardStyle}
      data-active={isActive || undefined}
    >
      {/* Active-state left accent bar */}
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -1,
            top: -1,
            bottom: -1,
            width: 4,
            background: 'var(--primary)',
            borderRadius: 'var(--r-lg) 0 0 var(--r-lg)',
          }}
        />
      )}

      {/* Top row: logo + title/company + bookmark */}
      <div className="flex items-start gap-3.5">
        <CompanyLogo
          src={job.company?.logo_url}
          name={companyName}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <h2
            className="text-card-title"
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              lineHeight: 1.25,
              color: 'var(--text)',
              letterSpacing: '-0.005em',
              marginBottom: 3,
            }}
          >
            {job.title}
          </h2>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)' }}>
            {companyName}
            {job.city && (
              <>
                {' · '}
                <span style={{ color: 'var(--text-muted)' }}>{job.city}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-label={isSaved ? 'Opgeslagen' : 'Opslaan'}
          onClick={(e) => e.preventDefault()}
          className="shrink-0 rounded"
          style={{
            padding: 6,
            color: isSaved ? 'var(--primary)' : 'var(--text-faint)',
            background: 'transparent',
          }}
        >
          <Bookmark
            size={18}
            strokeWidth={1.75}
            fill={isSaved ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Meta row: distance + city chip + new badge */}
      {(distanceKm != null || isNew) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <DistanceChip km={distanceKm} />
          {job.city && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px 3px 7px',
                fontSize: '0.75rem',
                borderRadius: 100,
                color: 'var(--text-2)',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              {job.city}
            </span>
          )}
          {isNew && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                fontSize: '0.6875rem',
                borderRadius: 100,
                background: 'var(--secondary)',
                color: 'var(--secondary-ink)',
                fontWeight: 600,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}
            >
              Nieuw
            </span>
          )}
        </div>
      )}

      {/* Excerpt — 2-line clamp from description */}
      {job.description && (
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            lineHeight: 1.55,
            margin: 0,
            marginTop: 10,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {stripHtml(job.description).slice(0, 200)}
        </p>
      )}

      {/* Salary row — mono, compact */}
      {hasSalary && (
        <div
          className="mt-2.5"
          style={{
            fontFamily: 'var(--font-mono-stack)',
            fontSize: '0.9375rem',
            color: 'var(--text)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          {job.salary}
        </div>
      )}

      {/* Facets row (only if we have 1+ facets) */}
      {facets.length > 0 && (
        <div
          className="mt-2.5 flex flex-wrap items-center"
          style={{
            paddingTop: 10,
            borderTop: '1px dashed var(--border)',
            fontSize: '0.8125rem',
            color: 'var(--text-2)',
          }}
        >
          {facets.map((f, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5"
              style={{
                padding: idx === 0 ? '0 10px 0 0' : '0 10px',
                borderLeft: idx === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {f.icon}
              </span>
              {f.label}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}

function formatHours(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) {
    if (min === max) return `${min} uur`
    return `${min}–${max} u`
  }
  const v = (min ?? max) as number
  return `${v} uur`
}
