import {
  Briefcase,
  Clock,
  ExternalLink,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
  Search,
} from 'lucide-react'
import { formatRelative, formatEmploymentLabel, renderMarkdown, sanitizeHtml } from '@/lib/utils'
import { parseJobSections } from '@/lib/job-sections'
import { ContentSection } from './content-section'
import type { JobPosting } from '@/lib/queries'
import { ShareButtons } from './share-buttons'
import { ApplyLink } from './apply-link'
import Link from 'next/link'
import { slugifyCity } from '@lokale-banen/database'

interface JobDetailPanelProps {
  job: JobPosting
  tenantName?: string
  tenantDomain?: string
}

/**
 * Detail panel for the right side of the split-view.
 * Padding: 24px 32px, max-width 640px.
 */
export function JobDetailPanel({ job, tenantName, tenantDomain }: JobDetailPanelProps) {
  const companyName = job.company?.name || 'Onbekend bedrijf'
  const isExpired = job.end_date && new Date(job.end_date) < new Date()
  const employmentLabel = formatEmploymentLabel(job.employment, job.job_type)

  const rawContent = job.content_md || job.description || ''
  // Convert markdown to HTML first, then parse into sections
  const htmlContent = job.content_md ? renderMarkdown(rawContent) : sanitizeHtml(rawContent)
  const sections = parseJobSections(htmlContent)

  // Build metadata items for salary callout box
  const metaItems: string[] = []
  if (employmentLabel) metaItems.push(employmentLabel)
  if (job.working_hours_min && job.working_hours_max) {
    metaItems.push(`${job.working_hours_min}-${job.working_hours_max} uur/week`)
  }
  if (job.education_level) metaItems.push(job.education_level)

  const slug = job.slug || job.id
  const shareUrl = tenantDomain ? `https://${tenantDomain}/vacature/${slug}` : ''

  return (
    <article className="py-6 px-8 max-w-content">
      {/* Breadcrumbs */}
      {tenantName && (
        <nav className="flex items-center gap-1 text-meta mb-4 min-w-0" aria-label="Breadcrumb">
          <Link href="/" className="text-muted hover:text-primary transition-colors shrink-0">
            {tenantName}
          </Link>
          <span className="text-muted-foreground shrink-0">{' > '}</span>
          <span className="text-foreground font-medium truncate">{job.title}</span>
        </nav>
      )}

      {/* Expired banner */}
      {isExpired && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
          <p className="text-body font-medium text-red-700">
            Deze vacature is verlopen en niet meer beschikbaar.
          </p>
        </div>
      )}

      {/* 1. Title — text-h1 (20px/600), mb 4px */}
      <h1 className="text-h1 text-foreground mb-1">{job.title}</h1>

      {/* 2. Company + Location — mb 16px */}
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
              {job.city}{job.state && `, ${job.state}`}
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

      {/* 4. Solliciteer button area */}
      <div className="mt-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          {job.url && !isExpired ? (
            <ApplyLink
              jobUrl={job.url}
              jobId={job.id}
              className="flex-1 inline-flex items-center justify-center h-11 rounded-lg bg-primary text-primary-foreground text-button transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Solliciteer
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
            </ApplyLink>
          ) : (
            <button
              disabled
              className="flex-1 inline-flex items-center justify-center h-11 rounded-lg bg-background text-muted text-button cursor-not-allowed"
              style={{ border: '1px solid var(--border)' }}
            >
              {isExpired ? 'Vacature verlopen' : 'Geen sollicitatielink'}
            </button>
          )}
        </div>
        {/* Share buttons */}
        {shareUrl && (
          <div className="mt-3">
            <ShareButtons url={shareUrl} title={job.title} />
          </div>
        )}
      </div>

      {/* 5. Content sections (markdown) — mt 24px */}
      <div className="mt-6">
        {sections.watGaJeDoen && (
          <ContentSection title="Wat ga je doen?" content={sections.watGaJeDoen} />
        )}
        {sections.wieZoekenWe && (
          <ContentSection title="Wie zoeken we?" content={sections.wieZoekenWe} />
        )}
        {sections.watBiedenWe && (
          <ContentSection title="Wat bieden we?" content={sections.watBiedenWe} />
        )}
        {!sections.watGaJeDoen && !sections.wieZoekenWe && !sections.watBiedenWe && htmlContent && (
          <ContentSection title="Over deze vacature" content={htmlContent} />
        )}
        {!sections.watGaJeDoen && !sections.wieZoekenWe && !sections.watBiedenWe && !htmlContent && (
          <section className="mt-6">
            <p className="text-body text-muted italic">
              Er is geen beschrijving beschikbaar voor deze vacature.
              Bezoek de website van de werkgever voor meer informatie.
            </p>
          </section>
        )}
      </div>

      {/* 6. Company block — mt 32px */}
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

      {/* Mini-footer in detail panel (desktop only, since main footer is lg:hidden) */}
      <nav className="mt-12 pt-6 border-t border-[var(--border)] text-meta text-[var(--muted)]" aria-label="Footer links">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/over-ons" className="hover:text-[var(--foreground)] transition-colors">Over ons</Link>
          <Link href="/contact" className="hover:text-[var(--foreground)] transition-colors">Contact</Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy</Link>
          <Link href="/voorwaarden" className="hover:text-[var(--foreground)] transition-colors">Voorwaarden</Link>
        </div>
        <p className="mt-2 text-caption text-[var(--muted-foreground)]">
          © {new Date().getFullYear()} {tenantName || 'Lokale Banen'}
        </p>
      </nav>
    </article>
  )
}

/**
 * Empty state when no job is selected in split-view.
 */
export function EmptyDetailState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <Briefcase className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
      <p className="text-h2 text-muted">Selecteer een vacature</p>
      <p className="text-body text-muted-foreground mt-1">
        Klik op een vacature links om de details te bekijken
      </p>
    </div>
  )
}

/**
 * Empty state when no results found (shown in list panel).
 */
export function NoResultsState() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <Search className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
      <p className="text-h2 text-foreground">Geen vacatures gevonden</p>
      <p className="text-body text-muted mt-1">
        Probeer andere zoektermen
      </p>
      <Link
        href="/"
        className="text-body font-semibold text-primary mt-3 hover:underline"
      >
        Filters wissen
      </Link>
    </div>
  )
}


