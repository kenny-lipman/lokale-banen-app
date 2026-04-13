import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getTenant } from '@/lib/tenant'
import { formatRelative } from '@/lib/utils'
import { getApplications } from '@/app/actions/applications'
import { TenantHeader } from '@/components/tenant-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Mijn sollicitaties',
}

const METHOD_LABELS: Record<string, string> = {
  external_redirect: 'Externe website',
  email: 'E-mail',
  internal_form: 'Formulier',
}

export default async function ApplicationsPage() {
  const tenant = await getTenant()

  if (!tenant) {
    redirect('/')
  }

  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/account/sollicitaties')
  }

  const applications = await getApplications()

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
          Mijn sollicitaties{applications.length > 0 ? ` (${applications.length})` : ''}
        </h1>

        {applications.length > 0 ? (
          <div className="space-y-3">
            {applications.map((item) => {
              const job = item.job
              if (!job) return null

              return (
                <Link
                  key={item.id}
                  href={`/vacature/${job.slug || job.id}`}
                  className="flex items-start gap-3 rounded-lg p-4 group transition-colors hover:bg-card-hover"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {job.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {job.company_name || 'Onbekend bedrijf'}
                      {job.city && ` \u00B7 ${job.city}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Gesolliciteerd {formatRelative(item.applied_at)}
                      {item.method && ` \u00B7 Via: ${METHOD_LABELS[item.method] || item.method}`}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-base text-muted-foreground mb-4">
              Je hebt nog niet gesolliciteerd op vacatures.
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
