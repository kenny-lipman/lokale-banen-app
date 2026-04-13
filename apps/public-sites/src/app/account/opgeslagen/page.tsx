import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getTenant } from '@/lib/tenant'
import { formatRelative } from '@/lib/utils'
import { getSavedJobs } from '@/app/actions/saved-jobs'
import { TenantHeader } from '@/components/tenant-header'
import { UnsaveButton } from './unsave-button'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Bookmark } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Opgeslagen vacatures',
}

export default async function SavedJobsPage() {
  const tenant = await getTenant()

  if (!tenant) {
    redirect('/')
  }

  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/account/opgeslagen')
  }

  const savedJobs = await getSavedJobs()

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader tenant={tenant} showSearch={false} />

      <div className="border-b bg-background">
        <div className="container flex items-center h-12">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/account" className="flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Mijn Account
            </Link>
          </Button>
        </div>
      </div>

      <main className="flex-1 container py-6 sm:py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">
          Opgeslagen vacatures{savedJobs.length > 0 ? ` (${savedJobs.length})` : ''}
        </h1>

        {savedJobs.length > 0 ? (
          <div className="space-y-3">
            {savedJobs.map((item) => {
              const job = item.job
              if (!job) return null

              return (
                <div
                  key={item.job_posting_id}
                  className="flex items-start gap-3 rounded-lg p-4"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <Link
                    href={`/vacature/${job.slug || job.id}`}
                    className="flex-1 min-w-0 group"
                  >
                    <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {job.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {job.company_name || 'Onbekend bedrijf'}
                      {job.city && ` \u00B7 ${job.city}`}
                    </p>
                    {job.salary && job.salary.trim() !== '-' && job.salary.trim() !== '' && (
                      <p className="text-sm font-semibold text-foreground mt-1">
                        {job.salary}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Opgeslagen {formatRelative(item.saved_at)}
                    </p>
                  </Link>

                  <UnsaveButton jobId={item.job_posting_id} />
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bookmark className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-base text-muted-foreground mb-4">
              Je hebt nog geen vacatures opgeslagen.
            </p>
            <Button asChild>
              <Link href="/">Vacatures bekijken</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
