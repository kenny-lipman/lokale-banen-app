import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { SignOutButton } from '@clerk/nextjs'
import Link from 'next/link'
import { Bookmark, FileText, Settings, LogOut } from 'lucide-react'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
  PillButton,
} from '@/components/eyeron'

export const metadata = { title: 'Mijn account' }

const MENU_ITEMS = [
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
] as const

export default async function AccountPage() {
  const tenant = await getTenant()
  if (!tenant) redirect('/')

  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/account')

  const user = await currentUser()
  if (!user) redirect('/sign-in?redirect_url=/account')

  const cities = await getCitiesWithJobCounts(tenant.id)

  const displayName = user.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : 'Mijn account'
  const email = user.emailAddresses[0]?.emailAddress
  const initial = (user.firstName || email || 'U').slice(0, 1).toUpperCase()

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[{ label: tenant.name, href: '/' }, { label: 'Mijn account' }]}
        />

        {/* User chip */}
        <div className="flex items-center gap-4 mb-9 max-w-2xl">
          {user.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.imageUrl}
              alt=""
              className="size-16 rounded-full bg-surface object-cover"
            />
          ) : (
            <div className="size-16 rounded-full bg-primary flex items-center justify-center">
              <span className="text-h2 font-bold text-primary-ink">{initial}</span>
            </div>
          )}
          <div>
            <PageHero title={displayName} className="!mb-0" />
            {email && (
              <p className="m-0 mt-1 text-meta font-light text-muted">{email}</p>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="grid gap-3 max-w-2xl">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group block bg-surface border border-divider-subtle p-5 hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center justify-center size-11 bg-primary-tint shrink-0">
                  <item.icon
                    className="size-5 text-primary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="m-0 text-body font-bold text-primary tracking-tight group-hover:text-primary-hover">
                    {item.label}
                  </h2>
                  <p className="m-0 mt-0.5 text-meta font-light text-muted">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 max-w-2xl">
          <SignOutButton>
            <PillButton type="button">
              <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />
              Uitloggen
            </PillButton>
          </SignOutButton>
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
