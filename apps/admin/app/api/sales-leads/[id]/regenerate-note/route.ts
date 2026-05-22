import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { generateDealNote } from '@/lib/services/sales-leads/auto-note'
import type { Json } from '@/lib/supabase'
import type { MasterRecord, NormalizedVacancy } from '@/lib/services/sales-leads/types'

export const runtime = 'nodejs'

async function handler(
  _req: NextRequest,
  _auth: AuthResult,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()

  const { data: run, error } = await supabase
    .from('sales_lead_runs')
    .select('id, master_record')
    .eq('id', id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  const master = run.master_record as MasterRecord | null
  if (!master) {
    return NextResponse.json({ error: 'master_record ontbreekt' }, { status: 400 })
  }

  const noteHtml = await generateDealNote({
    master,
    selectedVacancies: (master.vacancies ?? []) as NormalizedVacancy[],
    supabase,
  })

  const updated: MasterRecord = { ...master, deal_note_text: noteHtml }
  const { error: upErr } = await supabase
    .from('sales_lead_runs')
    .update({ master_record: updated as unknown as Json, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ deal_note_text: noteHtml })
}

export const POST = withAuth(handler)
