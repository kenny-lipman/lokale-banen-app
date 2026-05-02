import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { UserProfile } from '@clerk/nextjs'
import { getTenant } from '@/lib/tenant'
import { getCitiesWithJobCounts } from '@/lib/queries'
import {
  SiteHeader,
  SiteFooter,
  Breadcrumbs,
  PageHero,
} from '@/components/eyeron'

export const metadata = { title: 'Mijn profiel' }

export default async function ProfilePage() {
  const tenant = await getTenant()
  if (!tenant) redirect('/')

  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/account/profiel')

  const cities = await getCitiesWithJobCounts(tenant.id)

  return (
    <div className="flex flex-col min-h-screen">
      <SiteHeader tenant={tenant} />

      <main className="flex-1 max-w-content mx-auto w-full px-pad py-8">
        <Breadcrumbs
          className="mb-5"
          items={[
            { label: tenant.name, href: '/' },
            { label: 'Mijn account', href: '/account' },
            { label: 'Profiel' },
          ]}
        />
        <PageHero
          title="Profiel"
          description="Beheer je account-instellingen en voorkeuren."
        />

        <div className="bg-surface border border-divider-subtle p-2 sm:p-4 max-w-3xl">
          <UserProfile
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none border-0 rounded-none',
              },
            }}
          />
        </div>
      </main>

      <SiteFooter tenant={tenant} cities={cities} />
    </div>
  )
}
