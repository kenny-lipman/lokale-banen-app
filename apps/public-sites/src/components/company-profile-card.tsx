import Link from 'next/link'
import { Globe, Linkedin, MapPin, Building2 } from 'lucide-react'
import type { CompanyProfile } from '@/lib/queries'
import { slugifyCity } from '@lokale-banen/database'

interface CompanyProfileCardProps {
  company: CompanyProfile
}

/**
 * Company profile card for the /bedrijf/[slug] page.
 * Shows logo, name, description, links, and location.
 */
export function CompanyProfileCard({ company }: CompanyProfileCardProps) {
  const citySlug = company.city ? slugifyCity(company.city) : null

  return (
    <div
      className="rounded-lg p-6"
      style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
    >
      <div className="flex items-start gap-4">
        {/* Logo */}
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={`${company.name} logo`}
            className="h-14 w-14 rounded-lg object-contain shrink-0"
            style={{ border: '1px solid var(--border)' }}
          />
        ) : (
          <div
            className="h-14 w-14 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="text-display text-foreground">{company.name}</h1>

          {/* Location */}
          {company.city && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden="true" />
              {citySlug ? (
                <Link
                  href={`/vacatures/${citySlug}`}
                  className="text-body text-muted hover:text-primary transition-colors"
                >
                  {company.city}
                </Link>
              ) : (
                <span className="text-body text-muted">{company.city}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {company.description && (
        <p className="text-body text-muted mt-4 line-clamp-4">
          {company.description}
        </p>
      )}

      {/* Links */}
      <div className="flex flex-wrap items-center gap-3 mt-4">
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-meta text-primary hover:underline"
          >
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            Website
          </a>
        )}
        {company.linkedin_url && (
          <a
            href={company.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-meta text-primary hover:underline"
          >
            <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
            LinkedIn
          </a>
        )}
        {company.kvk && (
          <span className="text-meta text-muted">
            KvK: {company.kvk}
          </span>
        )}
      </div>
    </div>
  )
}
