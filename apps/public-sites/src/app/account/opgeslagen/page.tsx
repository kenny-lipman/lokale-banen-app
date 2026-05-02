import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import { formatRelative } from '@/lib/utils'
import { getSavedJobs } from '@/app/actions/saved-jobs'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  EmptyState,
  PillButton,
  ArrowRight,
} from '@/components/eyeron'
import { UnsaveButton } from './unsave-button'

export const metadata = { title: 'Opgeslagen vacatures' }

export default async function SavedJobsPage() {
  const tenant = await getTenant()
  if (!tenant) redirect('/')

  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/account/opgeslagen')

  const [savedJobs, cities] = await Promise.all([
    getSavedJobs(),
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
            { label: 'Opgeslagen' },
          ]}
        />
        <PageHero
          title="Opgeslagen vacatures"
          description={
            savedJobs.length > 0
              ? `${savedJobs.length.toLocaleString('nl-NL')} ${
                  savedJobs.length === 1 ? 'vacature' : 'vacatures'
                } in jouw bewaarde lijst.`
              : undefined
          }
        />

        {savedJobs.length > 0 ? (
          <ul className="grid gap-3 max-w-3xl m-0 p-0 list-none">
            {savedJobs.map((item) => {
              const job = item.job
              if (!job) return null
              return (
                <li
                  key={item.job_posting_id}
                  className="flex items-start gap-4 bg-surface border border-divider-subtle p-5"
                >
                  <Link
                    href={`/vacature/${job.slug || job.id}`}
                    className="flex-1 min-w-0 group no-underline"
                  >
                    <p className="m-0 text-body font-bold text-primary tracking-tight truncate group-hover:text-primary-hover group-hover:underline underline-offset-2">
                      {job.title}
                    </p>
                    <p className="m-0 mt-0.5 text-meta font-light text-body">
                      {job.company_name || 'Onbekend bedrijf'}
                      {job.city && ` · ${job.city}`}
                    </p>
                    {job.salary && job.salary.trim() !== '-' && job.salary.trim() !== '' && (
                      <p className="m-0 mt-1 text-meta font-bold text-primary">
                        {job.salary}
                      </p>
                    )}
                    <p className="m-0 mt-1 text-small font-light text-body">
                      Opgeslagen {formatRelative(item.saved_at)}
                    </p>
                  </Link>
                  <UnsaveButton jobId={item.job_posting_id} />
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            title="Nog geen opgeslagen vacatures"
            body="Klik op het bookmark-icoon op een vacature-card om hem hier op te slaan voor later."
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
