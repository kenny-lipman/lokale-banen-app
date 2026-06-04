import { Globe, Linkedin, MapPin } from 'lucide-react'

interface CompanyProfileProps {
  company: {
    name: string
    description: string | null
    logo_url: string | null
    website: string | null
    linkedin_url: string | null
    city: string | null
    postal_code: string | null
    street_address: string | null
  }
  /** Aantal vacatures bij dit bedrijf - voor de subtitel. */
  jobCount: number
}

/**
 * Bedrijf-detail hero - logo + naam + locatie + website/linkedin + over.
 * Top van de /bedrijf/[company-slug] pagina, vóór de vacature-lijst.
 */
export function CompanyProfile({ company, jobCount }: CompanyProfileProps) {
  const addressParts = [company.street_address, company.postal_code, company.city]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="grid sm:grid-cols-[120px_1fr] gap-6 sm:gap-7 mb-10 pb-8 border-b border-divider">
      <div className="size-[120px] flex items-center justify-center bg-surface border border-divider-subtle p-3">
        {company.logo_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={company.logo_url}
            alt={`${company.name} logo`}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <span className="text-h2 font-bold text-primary">
            {company.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div className="min-w-0">
        <h1 className="m-0 text-h1 font-bold text-primary tracking-tight leading-tight">
          {company.name}
        </h1>
        <p className="m-0 mt-2 text-meta font-light text-muted">
          {jobCount.toLocaleString('nl-NL')} {jobCount === 1 ? 'vacature' : 'vacatures'}
          {company.city && ` · ${company.city}`}
        </p>

        {company.description && (
          <p className="m-0 mt-4 text-meta font-light text-muted leading-relaxed max-w-prose">
            {company.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 mt-5">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-meta font-regular text-secondary hover:underline underline-offset-2"
            >
              <Globe className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Website
            </a>
          )}
          {company.linkedin_url && (
            <a
              href={company.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-meta font-regular text-secondary hover:underline underline-offset-2"
            >
              <Linkedin className="size-4" strokeWidth={1.75} aria-hidden="true" />
              LinkedIn
            </a>
          )}
          {addressParts && !company.website && !company.linkedin_url && (
            <span className="inline-flex items-center gap-1.5 text-meta font-light text-muted">
              <MapPin className="size-4" strokeWidth={1.75} aria-hidden="true" />
              {addressParts}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
