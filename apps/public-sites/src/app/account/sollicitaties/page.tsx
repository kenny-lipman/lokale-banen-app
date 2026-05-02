import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ExternalLink, FileText } from 'lucide-react'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { formatRelative } from '@/lib/utils'
import { getApplications } from '@/app/actions/applications'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  EmptyState,
  PillButton,
  ArrowRight,
} from '@/components/eyeron'

export const metadata = { title: 'Mijn sollicitaties' }

const METHOD_LABELS: Record<string, string> = {
  external_redirect: 'Externe website',
  email: 'E-mail',
  internal_form: 'Formulier',
}

export default async function ApplicationsPage() {
  const tenant = await getTenant()
  if (!tenant) redirect('/')

  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/account/sollicitaties')

  const [applications, cities] = await Promise.all([
    getApplications(),
    getCitiesWithJobCounts(tenant.id),
  ])

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[
            { label: tenant.name, href: '/' },
            { label: 'Mijn account', href: '/account' },
            { label: 'Sollicitaties' },
          ]}
        />
        <PageHero
          title="Mijn sollicitaties"
          description={
            applications.length > 0
              ? `${applications.length.toLocaleString('nl-NL')} ${
                  applications.length === 1 ? 'sollicitatie' : 'sollicitaties'
                } in jouw overzicht.`
              : undefined
          }
        />

        {applications.length > 0 ? (
          <ul className="grid gap-3 max-w-3xl m-0 p-0 list-none">
            {applications.map((item) => {
              const job = item.job
              if (!job) return null
              return (
                <li key={item.id}>
                  <Link
                    href={`/vacature/${job.slug || job.id}`}
                    className="group flex items-start gap-4 bg-surface border border-divider-subtle p-5 hover:shadow-card-hover transition-shadow"
                  >
                    <span className="inline-flex items-center justify-center w-11 h-11 bg-primary-tint shrink-0">
                      <FileText
                        className="h-5 w-5 text-primary"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-body font-bold text-primary tracking-tight truncate group-hover:text-primary-hover">
                        {job.title}
                      </p>
                      <p className="m-0 mt-0.5 text-meta font-light text-body">
                        {job.company_name || 'Onbekend bedrijf'}
                        {job.city && ` · ${job.city}`}
                      </p>
                      <p className="m-0 mt-1 text-small font-light text-body">
                        Gesolliciteerd {formatRelative(item.applied_at)}
                        {item.method && ` · Via: ${METHOD_LABELS[item.method] || item.method}`}
                      </p>
                    </div>
                    <ExternalLink
                      className="h-4 w-4 text-secondary shrink-0 mt-1 group-hover:text-secondary-hover"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title="Nog geen sollicitaties"
            body="Wanneer je via een vacature solliciteert, verschijnt die hier in je overzicht."
            action={
              <PillButton href="/" variant="primary">
                Naar de vacatures
                <ArrowRight />
              </PillButton>
            }
          />
        )}
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
