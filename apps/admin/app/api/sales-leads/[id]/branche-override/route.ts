// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getBrancheOptions } from '@/lib/services/sales-leads/branche-options.service'
import { generateDealNote } from '@/lib/services/sales-leads/auto-note'
import type { Json } from '@/lib/supabase'
import type { MasterRecord, NormalizedVacancy } from '@/lib/services/sales-leads/types'

export const runtime = 'nodejs'

const patchSchema = z.object({
  branche_override: z.number().int().nullable(),
})

async function handler(
  req: NextRequest,
  _auth: AuthResult,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const override = parsed.data.branche_override

  if (override !== null) {
    const options = await getBrancheOptions()
    if (!options.some((o) => o.pipedrive_enum_id === override)) {
      return NextResponse.json(
        { error: `Onbekende branche enum_id: ${override}` },
        { status: 400 },
      )
    }
  }

  const supabase = createServiceRoleClient()
  const { data: run, error: fetchErr } = await supabase
    .from('sales_lead_runs')
    .select('id, master_record')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  // Regenereer note zodat het branche-label in de notitie meteen klopt, en schrijf
  // beide in 1 update. Voorkomt inconsistente staat als de 2e write zou falen
  // (branche_override gezet maar master.deal_note_text nog op oude branche-label).
  const master = run.master_record as MasterRecord | null
  let noteHtml: string | null = null
  const update: {
    branche_override: number | null
    updated_at: string
    master_record?: Json
  } = {
    branche_override: override,
    updated_at: new Date().toISOString(),
  }
  if (master) {
    noteHtml = await generateDealNote({
      master,
      selectedVacancies: (master.vacancies ?? []) as NormalizedVacancy[],
      brancheEnumId: override,
      supabase,
    })
    const updatedMaster: MasterRecord = { ...master, deal_note_text: noteHtml }
    update.master_record = updatedMaster as unknown as Json
  }

  const { error: updErr } = await supabase
    .from('sales_lead_runs')
    .update(update)
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ branche_override: override, deal_note_text: noteHtml })
}

export const PATCH = withAuth(handler)
