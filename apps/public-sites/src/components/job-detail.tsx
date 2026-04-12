import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Banknote,
  Clock,
  Briefcase,
  CalendarDays,
  Globe,
  Linkedin,
  MapPin,
} from 'lucide-react'
import { formatRelative } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'
import { JobCard } from './job-card'

interface JobDetailProps {
  job: JobPosting
  relatedJobs: JobPosting[]
}

/**
 * Full job detail content following DESIGN.md section 4.
 * Question-based H2 sections for GEO optimization.
 * Salary callout box, company block with sameAs links.
 */
export function JobDetail({ job, relatedJobs }: JobDetailProps) {
  const companyName = job.company?.name || job.company_name || 'Onbekend bedrijf'
  const companyInitials = companyName.slice(0, 2).toUpperCase()
  const logoUrl = job.company?.logo_url
  const isExpired = job.end_date && new Date(job.end_date) < new Date()

  // Parse description into sections if structured, otherwise use as-is
  const sections = parseJobSections(job.description || '')

  return (
    <article className="max-w-3xl mx-auto">
      {/* Expired banner */}
      {isExpired && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-destructive">
            Deze vacature is verlopen en niet meer beschikbaar.
          </p>
        </div>
      )}

      {/* Header: logo + title + company */}
      <header className="mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="h-16 w-16 rounded-lg shrink-0 overflow-hidden bg-muted flex items-center justify-center border">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-sm font-semibold text-muted-foreground">
                {companyInitials}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-h1 font-bold tracking-tight">{job.title}</h1>
            <p className="text-body text-muted-foreground mt-1">
              <span className="font-medium text-foreground">@ {companyName}</span>
              {job.city && (
                <>
                  {' '}
                  <span aria-hidden="true">·</span> {job.city}
                  {job.state && `, ${job.state}`}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Info callout box */}
        <Card className="bg-emerald-50/50 border-emerald-200/60">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {job.salary && (
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span className="font-semibold text-emerald-800 tabular-nums">
                    {job.salary}
                  </span>
                </div>
              )}
              {job.employment_type && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>{job.employment_type}</span>
                </div>
              )}
              {job.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>{job.city}</span>
                </div>
              )}
              {job.published_at && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                  <span>Gepost: {formatRelative(job.published_at)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </header>

      {/* Content sections */}
      <div className="prose-sm max-w-none space-y-6">
        {sections.watGaJeDoen && (
          <section>
            <h2>Wat ga je doen?</h2>
            <div
              className="text-body leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: sections.watGaJeDoen }}
            />
          </section>
        )}

        {sections.wieZoekenWe && (
          <section>
            <h2>Wie zoeken we?</h2>
            <div
              className="text-body leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: sections.wieZoekenWe }}
            />
          </section>
        )}

        {sections.watBiedenWe && (
          <section>
            <h2>Wat bieden we?</h2>
            <div
              className="text-body leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: sections.watBiedenWe }}
            />
          </section>
        )}

        {/* Fallback: if no structured sections, show full description */}
        {!sections.watGaJeDoen && !sections.wieZoekenWe && !sections.watBiedenWe && job.description && (
          <section>
            <h2>Over deze vacature</h2>
            <div
              className="text-body leading-relaxed text-foreground/90"
              dangerouslySetInnerHTML={{ __html: job.description }}
            />
          </section>
        )}
      </div>

      {/* Company block */}
      {job.company && (
        <>
          <Separator className="my-8" />
          <section>
            <h2 className="mb-4">Over {companyName}</h2>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-md shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={companyName}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        {companyInitials}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-h3">{companyName}</h3>
                    {job.company.description && (
                      <p className="text-meta text-muted-foreground mt-1 line-clamp-3">
                        {job.company.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      {job.company.website && (
                        <a
                          href={job.company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-meta text-primary hover:underline"
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
                          className="inline-flex items-center gap-1.5 text-meta text-primary hover:underline"
                        >
                          <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* Related jobs */}
      {relatedJobs.length > 0 && (
        <>
          <Separator className="my-8" />
          <section>
            <h2 className="mb-4">Vergelijkbare banen</h2>
            <div className="grid gap-3">
              {relatedJobs.map((relatedJob) => (
                <JobCard key={relatedJob.id} job={relatedJob} />
              ))}
            </div>
          </section>
        </>
      )}
    </article>
  )
}

interface JobSections {
  watGaJeDoen: string | null
  wieZoekenWe: string | null
  watBiedenWe: string | null
}

/**
 * Attempt to parse a job description into structured sections.
 * Looks for common Dutch headings in the HTML content.
 */
function parseJobSections(html: string): JobSections {
  const sections: JobSections = {
    watGaJeDoen: null,
    wieZoekenWe: null,
    watBiedenWe: null,
  }

  if (!html) return sections

  const lowerHtml = html.toLowerCase()

  // Common heading patterns for Dutch job postings
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

  // Simple extraction: find section by heading, take content until next heading
  const headingRegex = /<h[1-4][^>]*>(.*?)<\/h[1-4]>/gi
  const headings: { index: number; text: string }[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({ index: match.index, text: match[1] })
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index
    const headingEnd = html.indexOf('>', start) + 1
    // Find the end of the heading tag
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
