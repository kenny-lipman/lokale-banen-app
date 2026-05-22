import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { BrancheMappingClient } from './branche-mapping-client'

export const dynamic = 'force-dynamic'

export default async function BrancheMappingPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/admin/instellingen/branche-mapping')

  const role = (user.app_metadata as Record<string, unknown> | undefined)?.role
  if (role !== 'admin') redirect('/otis')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <BrancheMappingClient />
    </div>
  )
}
