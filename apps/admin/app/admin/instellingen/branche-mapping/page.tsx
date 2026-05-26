import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function BrancheMappingRedirectPage() {
  redirect('/settings?tab=branche-mapping')
}
