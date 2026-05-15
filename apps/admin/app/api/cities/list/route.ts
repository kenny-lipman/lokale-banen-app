import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

export interface CityListRow {
  id: string
  plaats: string
  postcode: string | null
  platform_id: string | null
  source: string
  is_active: boolean | null
  created_at: string | null
  updated_at: string
  current_regio_platform: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
  job_postings_count: number
}

type Status = 'all' | 'mapped' | 'unmapped' | 'suggestion'
type Source = 'all' | 'manual' | 'cbs_pc4'

const VALID_STATUS: Status[] = ['all', 'mapped', 'unmapped', 'suggestion']
const VALID_SOURCE: Source[] = ['all', 'manual', 'cbs_pc4']

async function handler(req: NextRequest, _auth: AuthResult) {
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? 'all'
  const source = url.searchParams.get('source') ?? 'all'
  const platformId = url.searchParams.get('platform_id')
  const search = url.searchParams.get('q')?.trim() ?? null
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50', 10), 1), 500)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0)

  if (!VALID_STATUS.includes(status as Status))
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  if (!VALID_SOURCE.includes(source as Source))
    return NextResponse.json({ error: 'invalid source' }, { status: 400 })
  if (platformId && !/^[0-9a-f-]{36}$/i.test(platformId))
    return NextResponse.json({ error: 'invalid platform_id' }, { status: 400 })

  const svc = createServiceRoleClient()
  const { data, error } = await svc.rpc('cities_with_suggestions_paged', {
    p_status: status,
    p_source: source,
    p_platform_id: platformId,
    p_search: search || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    console.error('cities_with_suggestions_paged RPC error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const rows = (data ?? []) as Array<CityListRow & { total_count: number }>
  const total = rows[0]?.total_count ?? 0

  return NextResponse.json({
    rows: rows.map(({ total_count: _t, ...r }) => r),
    total: Number(total),
    limit,
    offset,
  })
}

export const GET = withAdminAuth(handler)
