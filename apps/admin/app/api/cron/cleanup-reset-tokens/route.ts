// @auth SECRET
import { NextRequest, NextResponse } from 'next/server'
import { withCronMonitoring } from '@/lib/cron-monitor'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

async function handler(_req: NextRequest) {
  const supabase = createServiceRoleClient()
  // Verwijder tokens die >7 dagen geleden zijn verlopen (audit-window).
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error, count } = await supabase
    .from('password_reset_tokens')
    .delete({ count: 'exact' })
    .lt('expires_at', cutoff)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, deleted: count ?? 0 })
}

const monitored = withCronMonitoring('cleanup-reset-tokens', '/api/cron/cleanup-reset-tokens')
export const GET = monitored(handler)
