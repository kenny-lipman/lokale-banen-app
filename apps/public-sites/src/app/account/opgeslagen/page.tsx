import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Bookmark } from 'lucide-react'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase'

export const metadata = {
  title: 'Opgeslagen vacatures',
}

export default async function SavedJobsPage() {
  const user = await currentUser()
  const tenant = await getTenant()

  if (!user) {
    redirect('/sign-in?redirect_url=/account/opgeslagen')
  }

  if (!tenant) {
    redirect('/')
  }

  // Fetch saved jobs for this user
  const supabase = createPublicClient()
  const { data: savedJobs } = await supabase
    .from('saved_jobs')
    .select(`
      saved_at,
      job_postings:job_posting_id (
        id, title, slug, company_name, city, employment_type, salary, published_at,
        companies!company_id (id, name, logo_url)
      )
    `)
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false })

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
        <h1 className="text-h1 font-bold mb-6">Opgeslagen vacatures</h1>

        {!savedJobs || savedJobs.length === 0 ? (
          <div className="text-center py-xl">
            <Bookmark className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-body text-muted-foreground mb-4">
              Je hebt nog geen vacatures opgeslagen.
            </p>
            <Button asChild>
              <Link href="/">Vacatures bekijken</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {savedJobs.map((saved: Record<string, unknown>) => {
              const job = saved.job_postings as Record<string, unknown> | null
              if (!job) return null

              const company = Array.isArray(job.companies)
                ? job.companies[0]
                : job.companies
              const companyName =
                (company as Record<string, unknown>)?.name ||
                job.company_name ||
                'Onbekend bedrijf'

              return (
                <Link
                  key={job.id as string}
                  href={`/vacature/${job.slug || job.id}`}
                  className="block group"
                >
                  <div className="flex items-center gap-4 p-4 rounded-lg border transition-all hover:shadow-md hover:border-border">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-body group-hover:text-primary transition-colors line-clamp-1">
                        {job.title as string}
                      </h2>
                      <p className="text-meta text-muted-foreground mt-0.5">
                        {companyName as string}
                        {job.city && ` · ${job.city}`}
                      </p>
                      {job.salary && (
                        <p className="text-meta font-semibold text-emerald-700 mt-1 tabular-nums">
                          {job.salary as string}
                        </p>
                      )}
                    </div>
                    <p className="text-meta text-muted-foreground shrink-0">
                      {new Date(saved.saved_at as string).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
