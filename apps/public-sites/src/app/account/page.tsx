import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TenantHeader } from '@/components/tenant-header'
import { getTenant } from '@/lib/tenant'
import { Bookmark, FileText, Settings, LogOut, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export default async function AccountPage() {
  const tenant = await getTenant()

  if (!tenant) {
    redirect('/')
  }

  // When Clerk is not configured, show placeholder
  if (!CLERK_ENABLED) {
    return (
      <div className="flex flex-col min-h-screen">
        <TenantHeader tenant={tenant} showSearch={false} />
        <main className="flex-1 container py-6 sm:py-8 max-w-2xl">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Mijn Account</h1>
            <p className="text-base text-muted-foreground mb-6">
              De accountfunctie is binnenkort beschikbaar.
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

  // Clerk-enabled account page
  let user = null
  try {
    const { currentUser } = await import('@clerk/nextjs/server')
    user = await currentUser()
  } catch {
    redirect('/sign-in?redirect_url=/account')
  }

  if (!user) {
    redirect('/sign-in?redirect_url=/account')
  }

  const menuItems = [
    {
      icon: Bookmark,
      label: 'Opgeslagen vacatures',
      description: 'Bewaar vacatures voor later',
      href: '/account/opgeslagen',
    },
    {
      icon: FileText,
      label: 'Mijn sollicitaties',
      description: 'Overzicht van je sollicitaties',
      href: '/account/sollicitaties',
    },
    {
      icon: Settings,
      label: 'Profiel',
      description: 'Beheer je account en voorkeuren',
      href: '/account/profiel',
    },
  ]

  let SignOutButton: React.ComponentType<{ children: React.ReactNode }> | null = null
  try {
    const clerk = await import('@clerk/nextjs')
    SignOutButton = clerk.SignOutButton
  } catch {
    // no-op
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TenantHeader tenant={tenant} showSearch={false} />

      <main className="flex-1 container py-6 sm:py-8 max-w-2xl">
        {/* User info */}
        <div className="flex items-center gap-4 mb-8">
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-16 w-16 rounded-full"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">
                {(user.firstName || user.emailAddresses[0]?.emailAddress || 'U')
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {user.firstName
                ? `${user.firstName} ${user.lastName || ''}`
                : 'Mijn Account'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>

        {/* Menu items */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href} className="block group">
              <Card className="transition-all hover:shadow-md hover:border-border">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base group-hover:text-primary transition-colors">
                      {item.label}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Sign out */}
        {SignOutButton && (
          <div className="mt-8">
            <SignOutButton>
              <Button variant="outline" className="w-full sm:w-auto">
                <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                Uitloggen
              </Button>
            </SignOutButton>
          </div>
        )}
      </main>
    </div>
  )
}
