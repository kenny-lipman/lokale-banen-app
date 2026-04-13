import { getTenant } from '@/lib/tenant'
import { TenantHeader } from '@/components/tenant-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings } from 'lucide-react'
import Link from 'next/link'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export const metadata = {
  title: 'Mijn profiel',
}

export default async function ProfilePage() {
  const tenant = await getTenant()

  if (!tenant) {
    return null
  }

  // When Clerk is not configured, show placeholder
  if (!CLERK_ENABLED) {
    return (
      <div className="flex flex-col min-h-screen">
        <TenantHeader tenant={tenant} showSearch={false} />
        <main className="flex-1 container py-6 sm:py-8 max-w-2xl">
          <div className="text-center py-12">
            <Settings className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Mijn profiel</h1>
            <p className="text-base text-muted-foreground mb-6">
              De profielfunctie is binnenkort beschikbaar.
            </p>
            <Button asChild>
              <Link href="/" className="inline-flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Terug naar vacatures
              </Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Clerk-enabled profile page
  let UserProfile: React.ComponentType<{ appearance: Record<string, unknown> }> | null = null
  try {
    const clerk = await import('@clerk/nextjs')
    UserProfile = clerk.UserProfile
  } catch {
    // Fall through
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
        {UserProfile ? (
          <UserProfile
            appearance={{
              elements: {
                rootBox: 'w-full max-w-3xl mx-auto',
                card: 'shadow-none border rounded-xl',
              },
            }}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-base text-muted-foreground">
              Profielbeheer is niet beschikbaar.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
