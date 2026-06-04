import type { Metadata } from 'next'
import Link from 'next/link'
import { getTenant } from '@/lib/tenant'
import {
  getCitiesWithJobCounts,
  getCompaniesWithJobCounts,
  type CompanyWithCount,
} from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  EmptyState,
} from '@/components/eyeron'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  return {
    title: `Bedrijven${tenant?.central_place ? ` in ${tenant.central_place}` : ''}`,
    description: tenant
      ? `Bekijk lokale werkgevers bij ${tenant.name}.`
      : 'Bekijk lokale werkgevers in jouw regio.',
  }
}

export default async function BedrijvenPage() {
  const tenant = await getTenant()
  if (!tenant) return null

  const [cities, companies] = await Promise.all([
    getCitiesWithJobCounts(tenant.id),
    getCompaniesWithJobCounts(tenant.id),
  ])
  const place = tenant.central_place || 'de regio'

  // Alleen bedrijven met een slug hebben een detailpagina.
  const linkable = companies.filter(c => c.slug)

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[
            { label: tenant.name, href: '/' },
            { label: 'Bedrijven' },
          ]}
        />
        <PageHero
          title={`Bedrijven in ${place}`}
          description={`Ontdek lokale werkgevers bij ${tenant.name} en bekijk hun openstaande vacatures.`}
        />

        {linkable.length === 0 ? (
          <EmptyState
            title="Binnenkort beschikbaar"
            body="Er zijn nog geen bedrijven met openstaande vacatures."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-s3">
            {linkable.map(company => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}

function CompanyCard({ company }: { company: CompanyWithCount }) {
  const initials = (company.name ?? '?').slice(0, 2).toUpperCase()
  const jobLabel =
    company.count === 1 ? '1 vacature' : `${company.count} vacatures`

  return (
    <Link
      href={`/bedrijf/${company.slug}`}
      className="flex items-center gap-4 p-4 bg-surface border border-divider rounded-card shadow-card hover:border-primary transition-colors"
    >
      {company.logo_url ? (
        <div className="shrink-0 size-14 flex items-center justify-center bg-surface border border-divider-subtle rounded-card p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company.logo_url}
            alt={`${company.name} logo`}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="shrink-0 size-14 flex items-center justify-center bg-primary text-primary-ink font-bold text-lg rounded-card">
          {initials}
        </div>
      )}

      <div className="min-w-0">
        <h3 className="text-h3 truncate">{company.name}</h3>
        {company.city && (
          <p className="text-meta text-muted truncate">{company.city}</p>
        )}
        <p className="text-meta text-primary">{jobLabel}</p>
      </div>
    </Link>
  )
}
