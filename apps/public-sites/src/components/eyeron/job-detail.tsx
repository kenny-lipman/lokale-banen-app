import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Briefcase, Clock, GraduationCap, MapPin, Calendar, Globe, Linkedin } from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'
import { slugifyCity } from '@lokale-banen/database'
import { ApplyButton } from './apply-button'
import { SaveJobButton } from './save-job-button'
import { ShareButtons } from './share-buttons'
import { VacatureCard } from './vacature-card'

interface JobDetailProps {
  job: JobPosting
  relatedJobs: JobPosting[]
  /** Volledige URL voor share-functies. */
  pageUrl: string
}

/**
 * Vacature-detail in Eyeron-stijl. 2-koloms grid (≥lg):
 *   - Main: title + company + meta-pills + description + company-block + related
 *   - Aside (sticky): apply-CTA + save + share + key-facts
 */
export function JobDetail({ job, relatedJobs, pageUrl }: JobDetailProps) {
  const companyName = job.company?.name || 'Onbekend bedrijf'
  const isExpired = !!(job.end_date && new Date(job.end_date) < new Date())
  const markdownContent = (job.content_md || job.description || '').trim()

  return (
    <article className="lg:grid lg:gap-gap-content lg:items-start lg:[grid-template-columns:1fr_344px]">
      {/* ── Main column ── */}
      <div className="min-w-0">
        {isExpired && (
          <div className="bg-surface border border-divider px-5 py-4 mb-6">
            <p className="m-0 text-meta font-bold text-primary">
              Deze vacature is verlopen en niet meer beschikbaar.
            </p>
          </div>
        )}

        {/* Title + company + location */}
        <header className="mb-6">
          <h1 className="m-0 text-h1 font-bold text-primary tracking-tight leading-tight">
            {job.title}
          </h1>
          <p className="m-0 mt-3 text-body tracking-tight">
            {job.company?.slug ? (
              <Link
                href={`/bedrijf/${job.company.slug}`}
                className="font-bold text-primary hover:underline underline-offset-2"
              >
                {companyName}
              </Link>
            ) : (
              <span className="font-bold text-primary">{companyName}</span>
            )}
            {job.city && (
              <>
                <span className="text-body font-light"> — </span>
                <Link
                  href={`/vacatures/${slugifyCity(job.city)}`}
                  className="text-body font-light hover:text-primary hover:underline underline-offset-2"
                >
                  {job.city}
                  {job.state && `, ${job.state}`}
                </Link>
              </>
            )}
          </p>
        </header>

        {/* Description */}
        <div className="mt-6">
          {!markdownContent ? (
            <p className="text-meta font-light text-body italic">
              Er is geen beschrijving beschikbaar voor deze vacature. Bezoek de
              website van de werkgever voor meer informatie.
            </p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-primary prose-headings:font-bold prose-h2:text-h2 prose-h3:text-h3 prose-p:text-meta prose-p:font-light prose-p:text-body prose-li:text-meta prose-li:font-light prose-li:text-body prose-strong:text-primary prose-strong:font-bold prose-a:text-secondary prose-a:no-underline hover:prose-a:underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {markdownContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Company block */}
        {job.company && (
          <section className="mt-10 bg-surface border border-divider-subtle px-6 py-5">
            <h2 className="m-0 text-h3 font-bold text-primary tracking-tight">
              Over {companyName}
            </h2>
            {job.company.description && (
              <p className="m-0 mt-2 text-meta font-light text-body line-clamp-4">
                {job.company.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              {job.company.slug && (
                <Link
                  href={`/bedrijf/${job.company.slug}`}
                  className="inline-flex items-center gap-2 text-meta font-regular text-secondary hover:underline underline-offset-2"
                >
                  Alle vacatures bij {companyName}
                </Link>
              )}
              {job.company.website && (
                <a
                  href={job.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-meta font-regular text-secondary hover:underline underline-offset-2"
                >
                  <Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Website
                </a>
              )}
              {job.company.linkedin_url && (
                <a
                  href={job.company.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-meta font-regular text-secondary hover:underline underline-offset-2"
                >
                  <Linkedin className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  LinkedIn
                </a>
              )}
            </div>
          </section>
        )}

        {/* Related */}
        {relatedJobs.length > 0 && (
          <section className="mt-12 pt-8 border-t border-divider">
            <h2 className="m-0 text-h2 font-bold text-primary tracking-tight mb-6">
              Vergelijkbare vacatures
            </h2>
            <div className="flex flex-col gap-[18px]">
              {relatedJobs.slice(0, 3).map((relatedJob) => (
                <VacatureCard key={relatedJob.id} job={relatedJob} />
              ))}
            </div>
          </section>
        )}

        {/* Share row (mobile + bottom of content) */}
        <div className="mt-10 pt-6 border-t border-divider-subtle">
          <ShareButtons url={pageUrl} title={job.title} />
        </div>
      </div>

      {/* ── Sticky sidebar ── */}
      <aside
        className="hidden lg:block lg:sticky"
        style={{ top: 'calc(var(--header-height-desk) + 24px)' }}
      >
        <div className="bg-surface border border-divider-subtle p-6 flex flex-col gap-4">
          <ApplyButton
            jobUrl={job.url}
            jobId={job.id}
            jobTitle={job.title}
            isExpired={isExpired}
            variant="inline"
          />

          <div className="flex items-center justify-between gap-2">
            <SaveJobButton jobId={job.id} variant="detail" />
            <ShareButtons url={pageUrl} title={job.title} variant="card" />
          </div>

          <dl className="mt-2 grid gap-3 pt-4 border-t border-divider-subtle">
            {job.salary && job.salary.trim() !== '-' && job.salary.trim() !== '' && (
              <FactRow icon={MoneyIcon} label="Salaris" value={job.salary} />
            )}
            {job.employment && (
              <FactRow icon={Briefcase} label="Dienstverband" value={job.employment} />
            )}
            {(job.working_hours_min || job.working_hours_max) && (
              <FactRow
                icon={Clock}
                label="Uren per week"
                value={formatHours(job.working_hours_min, job.working_hours_max)}
              />
            )}
            {job.education_level && (
              <FactRow icon={GraduationCap} label="Opleiding" value={job.education_level} />
            )}
            {job.city && (
              <FactRow
                icon={MapPin}
                label="Locatie"
                value={[job.city, job.state].filter(Boolean).join(', ')}
              />
            )}
            {job.published_at && (
              <FactRow icon={Calendar} label="Geplaatst" value={formatRelative(job.published_at)} />
            )}
          </dl>
        </div>
      </aside>
    </article>
  )
}

function FactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-secondary" strokeWidth={1.8} aria-hidden="true" />
      <div className="min-w-0">
        <dt className="m-0 text-small font-light text-body uppercase tracking-[0.06em]">
          {label}
        </dt>
        <dd className="m-0 mt-0.5 text-meta font-regular text-primary">{value}</dd>
      </div>
    </div>
  )
}

function MoneyIcon({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}

function formatHours(min: number | null, max: number | null): string {
  if (min == null && max == null) return ''
  if (min != null && max != null && min !== max) return `${min} - ${max} uur`
  return `${min ?? max} uur`
}
