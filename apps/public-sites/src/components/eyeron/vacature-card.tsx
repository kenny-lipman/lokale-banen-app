import Link from 'next/link'
import { Briefcase, Clock, GraduationCap } from 'lucide-react'
import type { JobPosting } from '@/lib/queries'
import { unwrapDescription } from '@/lib/utils'
import { ArrowRight } from './arrow-right'
import { SaveJobButton } from './save-job-button'

interface VacatureCardProps {
  job: JobPosting
  /** Optionele afstand in km (server-side berekend uit user-coords). */
  distanceKm?: number | null
}

/**
 * Vacature-kaart per Eyeron-spec - 3-koloms grid (141 logo / content / 168 meta).
 * Card-wide click-target via absolute pseudo-element zodat de hele card naar de
 * detail-pagina linkt; meta-links en bookmark blijven hun eigen click-handlers
 * houden via z-index.
 *
 * Mobile (<sm): stacked layout met logo bovenop (100px) en meta onder content.
 */
export function VacatureCard({ job, distanceKm }: VacatureCardProps) {
  const detailHref = `/vacature/${job.slug || job.id}`
  const company = job.company
  const employment = formatEmployment(job.employment, job.job_type)
  const hours = formatHours(job.working_hours_min, job.working_hours_max)
  const education = job.education_level

  return (
    <article className="group relative grid grid-cols-1 md:grid-cols-[141px_1fr_168px] bg-surface shadow-card hover:shadow-card-hover focus-within:shadow-card-hover transition-shadow duration-200 ease-eyeron md:min-h-[222px]">
      <CompanyLogoCell company={company} />

      <div className="flex flex-col gap-1 px-5 md:pt-[26px] md:pr-6 md:pb-[22px] md:pl-[30px] py-5 min-w-0">
        <h2 className="inline-flex items-center gap-2.5 text-h2 font-regular text-primary leading-tight tracking-tight m-0">
          <Link
            href={detailHref}
            className="text-primary no-underline group-hover:underline group-hover:underline-offset-4 group-hover:decoration-secondary"
          >
            <span className="relative z-[1]">{job.title}</span>
            <span aria-hidden="true" className="absolute inset-0 z-0" />
          </Link>
          <ArrowRight width={19} height={13} className="text-secondary" />
        </h2>

        <p className="m-0 mb-2 text-body tracking-tight font-light text-muted">
          {company?.name && <strong className="font-bold text-primary">{company.name}</strong>}
          {company?.name && (job.city || company.city) && (
            <span className="mx-2" aria-hidden="true">·</span>
          )}
          <span>{job.city || company?.city}</span>
        </p>

        {job.description && (
          <p className="m-0 text-meta font-normal text-muted leading-relaxed line-clamp-3 max-w-[60ch]">
            {plainText(job.description)}
          </p>
        )}
      </div>

      <div className="flex flex-row flex-wrap gap-y-2 gap-x-4 md:flex-col md:flex-nowrap md:gap-1.5 px-5 md:pr-6 pb-5 md:pt-[56px] md:pb-[22px] md:pl-0">
        {employment && <MetaRow icon={Briefcase}>{employment}</MetaRow>}
        {hours && <MetaRow icon={Clock}>{hours}</MetaRow>}
        {education && <MetaRow icon={GraduationCap}>{education}</MetaRow>}
        {distanceKm != null && (
          <MetaRow icon={Briefcase}>{distanceKm.toFixed(1)} km</MetaRow>
        )}

        <Link
          href={detailHref}
          className="relative z-[2] inline-flex items-center gap-2 text-meta font-regular text-secondary hover:text-secondary-hover hover:underline underline-offset-2 mt-1"
        >
          <ArrowRight width={13} height={8} />
          Bekijk vacature
        </Link>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-[2] inline-flex items-center gap-2 text-meta font-bold text-primary hover:text-primary-hover hover:underline underline-offset-2"
          >
            <ArrowRight width={13} height={8} />
            Solliciteer direct
          </a>
        )}
      </div>

      <div className="absolute top-0 right-0 z-[2]">
        <SaveJobButton jobId={job.id} variant="card-corner" />
      </div>
    </article>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function CompanyLogoCell({ company }: { company: JobPosting['company'] }) {
  const initials = (company?.name ?? '?').slice(0, 2).toUpperCase()

  if (company?.logo_url) {
    return (
      <div className="w-full h-[100px] md:w-[141px] md:h-[141px] self-stretch flex items-center justify-center bg-surface border-b md:border-b-0 md:border-r border-divider-subtle p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={company.logo_url}
          alt={`${company.name} logo`}
          className="max-w-full max-h-full object-contain"
          loading="lazy"
        />
      </div>
    )
  }

  // Fallback: gekleurde tegel met initialen - gebruik primary om brand-coherent te blijven.
  return (
    <div className="w-full h-[100px] md:w-[141px] md:h-[141px] self-stretch flex items-center justify-center bg-primary text-primary-ink font-bold text-2xl">
      {initials}
    </div>
  )
}

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-start gap-2 text-meta font-light text-muted leading-snug">
      <span className="inline-flex items-center justify-center h-[1.5em] shrink-0" aria-hidden="true">
        <Icon className="w-[13px] h-[13px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">{children}</span>
    </span>
  )
}

function formatEmployment(
  employment: string | null,
  jobType: string[] | null
): string | null {
  const parts: string[] = []
  if (jobType && jobType.length > 0) parts.push(jobType[0])
  if (employment) parts.push(employment)
  return parts.length > 0 ? parts.join(' / ') : null
}

function formatHours(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null && min !== max) return `${min} tot ${max} uur`
  return `${min ?? max} uur`
}

/** Strip HTML/markdown tot een leesbare 1-regel preview. */
function plainText(input: string): string {
  return (unwrapDescription(input) ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_#]+/g, '')
    .replace(/(^|\s)-{2,}(?=\s|$)/g, '$1') // strip "--" / "---" artefacten
    .replace(/\s+/g, ' ')
    .trim()
}
