import {
  Banknote,
  Clock,
  Briefcase,
  CalendarDays,
  Globe,
  Linkedin,
  MapPin,
  GraduationCap,
  ExternalLink,
} from 'lucide-react'
import { formatRelative, formatEmploymentLabel } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'

interface JobDetailPanelProps {
  job: JobPosting
}

/**
 * Detail panel for the right side of the split-view.
 * Renders inline — no page navigation.
 * Clean typography, salary callout, structured sections.
 */
export function JobDetailPanel({ job }: JobDetailPanelProps) {
  const companyName = job.company?.name || 'Onbekend bedrijf'
  const isExpired = job.end_date && new Date(job.end_date) < new Date()
  const employmentLabel = formatEmploymentLabel(job.employment, job.job_type)

  const rawContent = job.content_md || job.description || ''
  const sections = parseJobSections(rawContent)

  return (
    <article className="px-6 py-6 lg:px-8 lg:py-8 max-w-3xl">
      {/* Expired banner */}
      {isExpired && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-5">
          <p className="text-body font-medium text-destructive">
            Deze vacature is verlopen en niet meer beschikbaar.
          </p>
        </div>
      )}

      {/* Title + company */}
      <header className="mb-5">
        <h1 className="text-h1">{job.title}</h1>
        <p className="text-body text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{companyName}</span>
          {job.city && (
            <>
              {' '}&middot; {job.city}
              {job.state && `, ${job.state}`}
            </>
          )}
        </p>
      </header>

      {/* Salary + info callout */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-5">
        <div className="grid grid-cols-2 gap-2.5 text-body">
          {job.salary && (
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-emerald-800 tabular-nums">
                {job.salary}
              </span>
            </div>
          )}
          {employmentLabel && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{employmentLabel}</span>
            </div>
          )}
          {job.city && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{job.city}</span>
            </div>
          )}
          {job.published_at && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{formatRelative(job.published_at)}</span>
            </div>
          )}
          {job.working_hours_min && job.working_hours_max && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{job.working_hours_min}-{job.working_hours_max} uur/week</span>
            </div>
          )}
          {job.education_level && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{job.education_level}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex items-center gap-3 mb-6">
        {job.url && !isExpired ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-body transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Solliciteer
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <button
            disabled
            className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-muted text-muted-foreground font-semibold text-body cursor-not-allowed"
          >
            {isExpired ? 'Vacature verlopen' : 'Geen sollicitatielink'}
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="h-px bg-border mb-6" />

      {/* Content sections */}
      <div className="space-y-6">
        {sections.watGaJeDoen && (
          <section>
            <h2 className="text-h2 border-b border-border pb-2 mb-3">Wat ga je doen?</h2>
            <div
              className="text-body leading-relaxed text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_p]:mb-2 [&_li]:text-body"
              dangerouslySetInnerHTML={{ __html: sections.watGaJeDoen }}
            />
          </section>
        )}

        {sections.wieZoekenWe && (
          <section>
            <h2 className="text-h2 border-b border-border pb-2 mb-3">Wie zoeken we?</h2>
            <div
              className="text-body leading-relaxed text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_p]:mb-2 [&_li]:text-body"
              dangerouslySetInnerHTML={{ __html: sections.wieZoekenWe }}
            />
          </section>
        )}

        {sections.watBiedenWe && (
          <section>
            <h2 className="text-h2 border-b border-border pb-2 mb-3">Wat bieden we?</h2>
            <div
              className="text-body leading-relaxed text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_p]:mb-2 [&_li]:text-body"
              dangerouslySetInnerHTML={{ __html: sections.watBiedenWe }}
            />
          </section>
        )}

        {/* Fallback: if no structured sections, show full description */}
        {!sections.watGaJeDoen && !sections.wieZoekenWe && !sections.watBiedenWe && rawContent && (
          <section>
            <h2 className="text-h2 border-b border-border pb-2 mb-3">Over deze vacature</h2>
            <div
              className="text-body leading-relaxed text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_p]:mb-2 [&_li]:text-body"
              dangerouslySetInnerHTML={{ __html: rawContent }}
            />
          </section>
        )}
      </div>

      {/* Company block */}
      {job.company && (
        <>
          <div className="h-px bg-border my-6" />
          <section>
            <h2 className="text-h2 mb-3">Over {companyName}</h2>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold text-body text-foreground">{companyName}</h3>
              {job.company.description && (
                <p className="text-body text-muted-foreground mt-1 line-clamp-3">
                  {job.company.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3">
                {job.company.website && (
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-body text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    Website
                  </a>
                )}
                {job.company.linkedin_url && (
                  <a
                    href={job.company.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-body text-primary hover:underline"
                  >
                    <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </article>
  )
}

/**
 * Empty state when no job is selected in split-view.
 */
export function EmptyDetailState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-20">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Briefcase className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-h2 text-foreground mb-1">Kies een vacature</p>
      <p className="text-body text-muted-foreground">
        Klik op een vacature uit de lijst om de details te bekijken.
      </p>
    </div>
  )
}


// ---------------------------------------------------------------------------
// Section parsing (copied from job-detail.tsx, keep in sync)
// ---------------------------------------------------------------------------

interface JobSections {
  watGaJeDoen: string | null
  wieZoekenWe: string | null
  watBiedenWe: string | null
}

function parseJobSections(html: string): JobSections {
  const sections: JobSections = {
    watGaJeDoen: null,
    wieZoekenWe: null,
    watBiedenWe: null,
  }

  if (!html) return sections

  const taskPatterns = [
    /wat ga je doen/i, /jouw taken/i, /functieomschrijving/i,
    /werkzaamheden/i, /jouw rol/i, /de functie/i,
  ]
  const profilePatterns = [
    /wie zoeken we/i, /jouw profiel/i, /functie-eisen/i,
    /wat vragen we/i, /jij beschikt over/i, /profiel/i,
  ]
  const offerPatterns = [
    /wat bieden we/i, /wij bieden/i, /arbeidsvoorwaarden/i,
    /wat krijg je/i, /ons aanbod/i,
  ]

  const headingRegex = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi
  const headings: { index: number; text: string }[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ index: match.index, text: match[1] })
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index
    const headingEnd = html.indexOf('>', start) + 1
    const closingTag = html.indexOf('</', headingEnd)
    const sectionStart = html.indexOf('>', closingTag) + 1
    const sectionEnd = i + 1 < headings.length ? headings[i + 1].index : html.length
    const content = html.slice(sectionStart, sectionEnd).trim()
    const headingText = headings[i].text

    if (taskPatterns.some((p) => p.test(headingText))) {
      sections.watGaJeDoen = content
    } else if (profilePatterns.some((p) => p.test(headingText))) {
      sections.wieZoekenWe = content
    } else if (offerPatterns.some((p) => p.test(headingText))) {
      sections.watBiedenWe = content
    }
  }

  return sections
}
