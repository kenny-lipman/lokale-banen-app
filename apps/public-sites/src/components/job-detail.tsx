import {
  Globe,
  Linkedin,
  ExternalLink,
} from 'lucide-react'
import { formatRelative, formatEmploymentLabel, renderMarkdown } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'
import { JobCard } from './job-card'

interface JobDetailProps {
  job: JobPosting
  relatedJobs: JobPosting[]
}

/**
 * Full job detail content for the dedicated /vacature/[slug] page.
 * Used on mobile and for direct link access.
 * Follows same design language as JobDetailPanel but full-page.
 */
export function JobDetail({ job, relatedJobs }: JobDetailProps) {
  const companyName = job.company?.name || 'Onbekend bedrijf'
  const isExpired = job.end_date && new Date(job.end_date) < new Date()
  const employmentLabel = formatEmploymentLabel(job.employment, job.job_type)

  const rawContent = job.content_md || job.description || ''
  const htmlContent = job.content_md ? renderMarkdown(rawContent) : rawContent
  const sections = parseJobSections(htmlContent)

  // Build metadata items for salary callout box
  const metaItems: string[] = []
  if (employmentLabel) metaItems.push(employmentLabel)
  if (job.working_hours_min && job.working_hours_max) {
    metaItems.push(`${job.working_hours_min}-${job.working_hours_max} uur/week`)
  }
  if (job.education_level) metaItems.push(job.education_level)

  return (
    <article>
      {/* Expired banner */}
      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
          <p className="text-body font-medium text-red-700">
            Deze vacature is verlopen en niet meer beschikbaar.
          </p>
        </div>
      )}

      {/* 1. Title */}
      <h1 className="text-h1 text-foreground mb-1">{job.title}</h1>

      {/* 2. Company + Location */}
      <p className="mb-4">
        <span className="text-body-medium text-foreground">{companyName}</span>
        {job.city && (
          <>
            <span className="text-muted"> &middot; </span>
            <span className="text-body text-muted">
              {job.city}
              {job.state && `, ${job.state}`}
            </span>
          </>
        )}
      </p>

      {/* 3. Salary callout box */}
      <div
        className="p-3 px-4 rounded-lg mb-4"
        style={{
          backgroundColor: 'var(--background)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {job.salary && (
          <p className="text-salary text-salary">{job.salary}</p>
        )}
        {metaItems.length > 0 && (
          <p className="text-meta text-muted mt-2">
            {metaItems.join(' \u00B7 ')}
          </p>
        )}
        {job.published_at && (
          <p className="text-meta text-muted mt-1">
            Geplaatst: {formatRelative(job.published_at)}
          </p>
        )}
      </div>

      {/* 4. Desktop CTA (mobile uses sticky bottom) */}
      <div className="hidden sm:block mt-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          {job.url && !isExpired ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary text-primary-foreground text-button transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Solliciteer
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-background text-muted text-button cursor-not-allowed"
              style={{ border: '1px solid var(--border)' }}
            >
              {isExpired ? 'Vacature verlopen' : 'Geen sollicitatielink'}
            </button>
          )}
        </div>
      </div>

      {/* 5. Content sections */}
      <div className="mt-6">
        {sections.watGaJeDoen && (
          <ContentSection title="Wat ga je doen?" html={sections.watGaJeDoen} />
        )}
        {sections.wieZoekenWe && (
          <ContentSection title="Wie zoeken we?" html={sections.wieZoekenWe} />
        )}
        {sections.watBiedenWe && (
          <ContentSection title="Wat bieden we?" html={sections.watBiedenWe} />
        )}
        {!sections.watGaJeDoen && !sections.wieZoekenWe && !sections.watBiedenWe && htmlContent && (
          <ContentSection title="Over deze vacature" html={htmlContent} />
        )}
      </div>

      {/* 6. Company block */}
      {job.company && (
        <div
          className="mt-8 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--background)' }}
        >
          <h3 className="text-body-medium text-foreground font-semibold">{companyName}</h3>
          {job.company.description && (
            <p className="text-meta text-muted mt-1 line-clamp-3">
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
      )}

      {/* 7. Related jobs */}
      {relatedJobs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-h2 text-foreground mb-3">Vergelijkbare banen</h2>
          <div className="space-y-0">
            {relatedJobs.map((relatedJob) => (
              <JobCard key={relatedJob.id} job={relatedJob} variant="mobile" />
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

/**
 * Content section with H2 heading + HTML body.
 */
function ContentSection({ title, html }: { title: string; html: string }) {
  return (
    <section>
      <h2 className="text-h2 text-foreground mb-3 mt-6">{title}</h2>
      <div
        className="text-body text-foreground leading-[22px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1.5 [&_p]:mb-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Section parsing
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
