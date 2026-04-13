import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { UserProfile } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Mijn profiel',
}

export default async function ProfilePage() {
  const tenant = await getTenant()

  if (!tenant) {
    redirect('/')
  }

  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/account/profiel')
  }

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

      <main className="flex-1 container py-6 sm:py-8">
        <UserProfile
          appearance={{
            elements: {
              rootBox: 'w-full max-w-3xl mx-auto',
              card: 'shadow-none border rounded-xl',
            },
          }}
        />
      </main>
    </div>
  )
}
