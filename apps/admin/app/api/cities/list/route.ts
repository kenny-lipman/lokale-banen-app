import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

export interface CityListRow {
  id: string
  plaats: string
  postcode: string | null
  platform_id: string | null
  source: string
  is_active: boolean | null
  current_regio_platform: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
  job_postings_count: number
}

type Status = 'all' | 'mapped' | 'unmapped' | 'suggestion'
type Source = 'all' | 'manual' | 'cbs_pc4'

async function handler(req: NextRequest, auth: AuthResult) {
  const url = new URL(req.url)
  const status = (url.searchParams.get('status') ?? 'all') as Status
  const source = (url.searchParams.get('source') ?? 'all') as Source
  const platformId = url.searchParams.get('platform_id')
  const search = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 500)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  // RPC return is unbounded — we filteren client-side voor flexibiliteit.
  // 4.675 rijen past makkelijk; pagineer alleen het response.
  const { data, error } = await auth.supabase.rpc('cities_with_suggestions')
  if (error) {
    console.error('cities_with_suggestions RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  let rows = (data ?? []) as CityListRow[]

  if (status === 'mapped') rows = rows.filter((r) => r.platform_id !== null)
  if (status === 'unmapped') rows = rows.filter((r) => r.platform_id === null)
  if (status === 'suggestion')
    rows = rows.filter((r) => r.platform_id === null && r.suggested_platform_id !== null)

  if (source !== 'all') rows = rows.filter((r) => r.source === source)

  if (platformId) rows = rows.filter((r) => r.platform_id === platformId)

  if (search) {
    rows = rows.filter(
      (r) =>
        r.plaats.toLowerCase().includes(search) ||
        (r.postcode ?? '').includes(search) ||
        (r.current_regio_platform?.toLowerCase().includes(search) ?? false),
    )
  }

  rows.sort((a, b) => {
    const p = a.plaats.localeCompare(b.plaats, 'nl')
    if (p !== 0) return p
    return (a.postcode ?? '').localeCompare(b.postcode ?? '')
  })

  const total = rows.length
  const page = rows.slice(offset, offset + limit)

  return NextResponse.json({ rows: page, total, limit, offset })
}

export const GET = withAdminAuth(handler)
