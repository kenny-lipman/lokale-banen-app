// @auth SESSION
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withAuth, type AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { parseRunListQuery } from '@/lib/services/sales-leads/list-filters'

type RouteContext = unknown

async function listHandler(req: NextRequest, _auth: AuthResult, _ctx: RouteContext) {
  const url = new URL(req.url)
  const q = parseRunListQuery(url.searchParams)

  const supabase = createServiceRoleClient()
  let query = supabase
    .from('sales_lead_runs')
    .select(
      'id,status,input_domain,input_url,owner_config_id,master_record,pipedrive_org_id,pipedrive_deal_id,error,created_at,sales_lead_owner_config(label)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  // Gearchiveerde runs standaard verbergen (soft-archive). Met ?archived=1 toon
  // je ze wel (data-laag is voorbereid op een eventuele "toon gearchiveerd"-toggle).
  if (!q.include_archived) query = query.is('archived_at', null)
  if (q.status) query = query.eq('status', q.status)
  if (q.owner_config_id) query = query.eq('owner_config_id', q.owner_config_id)
  if (q.search) query = query.ilike('input_domain', `%${q.search}%`)
  if (q.date_from) query = query.gte('created_at', `${q.date_from}T00:00:00.000Z`)
  if (q.date_to) query = query.lte('created_at', `${q.date_to}T23:59:59.999Z`)

  const offset = (q.page - 1) * q.limit
  query = query.range(offset, offset + q.limit - 1)

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = {
    id: string
    status: string
    input_domain: string
    input_url: string
    owner_config_id: string
    master_record: unknown
    pipedrive_org_id: number | null
    pipedrive_deal_id: number | null
    error: string | null
    created_at: string
    sales_lead_owner_config: { label: string } | { label: string }[] | null
  }

  const runs = ((data as Row[] | null) ?? []).map((row) => {
    const ownerJoin = row.sales_lead_owner_config
    const owner_label = Array.isArray(ownerJoin)
      ? (ownerJoin[0]?.label ?? null)
      : (ownerJoin?.label ?? null)
    return {
      id: row.id,
      status: row.status,
      input_domain: row.input_domain,
      input_url: row.input_url,
      owner_config_id: row.owner_config_id,
      owner_label,
      master_record: row.master_record,
      pipedrive_org_id: row.pipedrive_org_id,
      pipedrive_deal_id: row.pipedrive_deal_id,
      error: row.error,
      created_at: row.created_at,
    }
  })

  return NextResponse.json({ runs, total: count ?? 0 })
}

export const GET = withAuth(listHandler)
