import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase'

export const metadata = {
  title: 'Mijn sollicitaties',
}

export default async function ApplicationsPage() {
  const user = await currentUser()
  const tenant = await getTenant()

  if (!user) {
    redirect('/sign-in?redirect_url=/account/sollicitaties')
  }

  if (!tenant) {
    redirect('/')
  }

  // Fetch applications for this user
  const supabase = createPublicClient()
  const { data: applications } = await supabase
    .from('job_applications')
    .select(`
      id, applied_at, method, status,
      job_postings:job_posting_id (
        id, title, slug, company_name, city, url,
        companies!company_id (id, name)
      )
    `)
    .eq('user_id', user.id)
    .order('applied_at', { ascending: false })

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
        <h1 className="text-h1 font-bold mb-6">Mijn sollicitaties</h1>

        {!applications || applications.length === 0 ? (
          <div className="text-center py-xl">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-body text-muted-foreground mb-4">
              Je hebt nog niet gesolliciteerd op vacatures.
            </p>
            <Button asChild>
              <Link href="/">Vacatures bekijken</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app: Record<string, unknown>) => {
              const job = app.job_postings as Record<string, unknown> | null
              if (!job) return null

              const company = Array.isArray(job.companies)
                ? job.companies[0]
                : job.companies
              const companyName =
                (company as Record<string, unknown>)?.name ||
                job.company_name ||
                'Onbekend bedrijf'

              const statusLabel = getStatusLabel(app.status as string)

              return (
                <div
                  key={app.id as string}
                  className="flex items-center gap-4 p-4 rounded-lg border"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/vacature/${job.slug || job.id}`}
                      className="font-semibold text-body hover:text-primary transition-colors line-clamp-1"
                    >
                      {job.title as string}
                    </Link>
                    <p className="text-meta text-muted-foreground mt-0.5">
                      {companyName as string}
                      {job.city && ` · ${job.city}`}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {statusLabel}
                      </Badge>
                      <span className="text-meta text-muted-foreground">
                        {new Date(app.applied_at as string).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  {job.url && (
                    <a
                      href={job.url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Bekijk originele vacature"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':
      return 'Verstuurd'
    case 'viewed':
      return 'Bekeken'
    case 'rejected':
      return 'Afgewezen'
    case 'invited':
      return 'Uitgenodigd'
    default:
      return 'Verstuurd'
  }
}
