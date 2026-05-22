import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { GebruikersClient } from './gebruikers-client'

export const dynamic = 'force-dynamic'

export default async function GebruikersPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/admin/gebruikers')

  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role
  if (role !== 'admin') redirect('/')

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <GebruikersClient currentUserId={user.id} />
    </div>
  )
}
