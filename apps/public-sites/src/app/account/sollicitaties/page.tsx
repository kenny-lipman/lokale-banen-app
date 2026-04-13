import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Mijn sollicitaties',
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

  // TODO: fetch applications from DB when job_applications table exists
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
        <h1 className="text-2xl font-bold mb-6">Mijn sollicitaties</h1>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-base text-muted-foreground mb-4">
            Je hebt nog niet gesolliciteerd op vacatures.
          </p>
          <Button asChild>
            <Link href="/">Vacatures bekijken</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
