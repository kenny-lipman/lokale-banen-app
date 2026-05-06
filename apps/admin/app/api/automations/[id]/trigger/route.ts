// apps/admin/app/api/automations/[id]/trigger/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'
import { getAutomation } from '@/lib/automations-registry'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function triggerHandler(
  request: NextRequest,
  auth: AuthResult,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const automation = getAutomation(id)
    if (!automation) {
      return NextResponse.json({ success: false, error: 'Automation not found' }, { status: 404 })
    }

    // Concurrency-lock: bestaande 'running' row binnen 6 minuten?
    const supabase = getServiceClient()
    const lockCutoff = new Date(Date.now() - 6 * 60_000).toISOString()
    const { data: running } = await supabase
      .from('automation_runs')
      .select('id, started_at')
      .eq('automation_id', id)
      .eq('status', 'running')
      .gte('started_at', lockCutoff)
      .limit(1)

    if (running && running.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Automation already running', runId: running[0].id },
        { status: 409 }
      )
    }

    // Server-side fetch naar handler — wrapper handelt insert/update af
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_KEY
    if (!cronSecret) {
      return NextResponse.json({ success: false, error: 'CRON_SECRET not configured' }, { status: 500 })
    }

    const protocol = request.nextUrl.protocol
    const host = request.headers.get('host')
    const handlerUrl = `${protocol}//${host}${automation.handlerPath}`

    // Kick off zonder te wachten — UI poolt voor afronding
    fetch(handlerUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'X-Automation-Trigger': 'manual',
        'X-Automation-User-Id': auth.user.id,
      },
    }).catch((err) => {
      console.error(`[trigger] fetch to ${handlerUrl} failed:`, err)
    })

    return NextResponse.json({ success: true, status: 'triggered', automationId: id })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error triggering automation:', errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export const POST = withAuth(triggerHandler)
