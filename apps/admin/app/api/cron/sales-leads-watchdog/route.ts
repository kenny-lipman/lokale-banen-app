import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Runs in status='enriching'/'syncing' moeten binnen 10 min in een eindstate zitten
// (maxDuration=300s op create-route + 60s op sync). Alles ouder dan 10min betekent
// dat de orchestrator/sync-flow gecrasht is zonder DB-status-update. We markeren
// die rijen als 'failed' zodat de UI-polling stopt en sales een retry kan starten.
const STUCK_MINUTES = 10

async function handler(_req: NextRequest) {
  const supabase = createServiceRoleClient()
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('sales_lead_runs')
    .update({
      status: 'failed',
      error: `Watchdog: status='enriching/syncing' bleef >${STUCK_MINUTES}min ongewijzigd (orchestrator timeout/crash). Klik 'Opnieuw' om een replay te starten.`,
      updated_at: new Date().toISOString(),
    })
    .in('status', ['enriching', 'syncing'])
    .lt('updated_at', cutoff)
    .select('id, input_domain, status, updated_at')

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({
    success: true,
    rescued_count: data?.length ?? 0,
    rescued: data?.map((r) => ({ id: r.id, domain: r.input_domain })) ?? [],
  })
}

const monitored = withCronMonitoring('sales-leads-watchdog', '/api/cron/sales-leads-watchdog')
export const GET = monitored(handler)
