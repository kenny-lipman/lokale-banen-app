import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  Globe,
  Linkedin,
  ExternalLink,
} from 'lucide-react'
import { formatRelative, formatEmploymentLabel } from '@/lib/utils'
import type { JobPosting } from '@/lib/queries'
import { JobCard } from './job-card'
import { ApplyLink } from './apply-link'
import { ContentSection } from './content-section'
import { parseJobSections } from '@/lib/job-sections'
import { slugifyCity } from '@lokale-banen/database'

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

  const markdownContent = (job.content_md || job.description || '').trim()
  const sections = parseJobSections(markdownContent)
  const hasAnySection = Boolean(
    sections.watGaJeDoen || sections.wieZoekenWe || sections.watBiedenWe
  )

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
        {job.company?.slug ? (
          <Link href={`/bedrijf/${job.company.slug}`} className="text-body-medium text-foreground hover:text-primary transition-colors">
            {companyName}
          </Link>
        ) : (
          <span className="text-body-medium text-foreground">{companyName}</span>
        )}
        {job.city && (
          <>
            <span className="text-muted"> &middot; </span>
            <Link href={`/vacatures/${slugifyCity(job.city)}`} className="text-body text-muted hover:text-primary transition-colors">
              {job.city}
              {job.state && `, ${job.state}`}
            </Link>
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
        {job.salary && job.salary.trim() !== '-' && job.salary.trim() !== '' && (
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
            <ApplyLink
              jobUrl={job.url}
              jobId={job.id}
              className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-primary text-primary-foreground text-button transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Solliciteer
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
            </ApplyLink>
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

      {/* 5. Description — split in recognised Dutch sections, fallback to full markdown */}
      <div className="mt-6">
        {!markdownContent ? (
          <section>
            <p className="text-body text-muted italic">
              Er is geen beschrijving beschikbaar voor deze vacature.
              Bezoek de website van de werkgever voor meer informatie.
            </p>
          </section>
        ) : hasAnySection ? (
          <>
            {sections.overige && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {sections.overige}
                </ReactMarkdown>
              </div>
            )}
            {sections.watGaJeDoen && (
              <ContentSection title="Wat ga je doen?" content={sections.watGaJeDoen} />
            )}
            {sections.wieZoekenWe && (
              <ContentSection title="Wie zoeken we?" content={sections.wieZoekenWe} />
            )}
            {sections.watBiedenWe && (
              <ContentSection title="Wat bieden we?" content={sections.watBiedenWe} />
            )}
          </>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {markdownContent}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* 6. Company block */}
      {job.company && (
        <div
          className="mt-8 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--background)' }}
        >
          {job.company.slug ? (
            <Link href={`/bedrijf/${job.company.slug}`} className="text-body-medium text-foreground font-semibold hover:text-primary transition-colors">
              {companyName}
            </Link>
          ) : (
            <h3 className="text-body-medium text-foreground font-semibold">{companyName}</h3>
          )}
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

