// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { computePrimaryMaster } from '@/lib/services/sales-leads/master-record'
import { generateDealNote } from '@/lib/services/sales-leads/auto-note'
import type { Json } from '@/lib/supabase'
import type { MasterRecord, RunEnrichments } from '@/lib/services/sales-leads/types'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Promote een alternatief candidate uit `enrichments[source].candidates[]`
 * naar `parsed`. Recompute de Maps-eigen master_record-velden (address,
 * coordinates, rating, etc.) terwijl andere user-edits behouden blijven.
 *
 * V1 ondersteunt alleen `source=google_maps`. Andere sources hebben (nog) geen
 * candidates-array.
 */
async function handler(req: NextRequest, _auth: AuthResult, ctx: RouteContext) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as
    | { source?: string; index?: number }
    | null
  if (!body || body.source !== 'google_maps' || typeof body.index !== 'number') {
    return NextResponse.json(
      { error: 'Body vereist: { source: "google_maps", index: number }' },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data: run, error: loadErr } = await supabase
    .from('sales_lead_runs')
    .select('id,status,input_url,enrichments,master_record')
    .eq('id', id)
    .maybeSingle()
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!run) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  const enrichments = (run.enrichments ?? {}) as RunEnrichments
  const mapsEntry = enrichments.google_maps
  const candidates = mapsEntry?.candidates
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ error: 'Geen candidates beschikbaar' }, { status: 400 })
  }
  if (body.index < 0 || body.index >= candidates.length) {
    return NextResponse.json(
      { error: `Index ${body.index} buiten range (0..${candidates.length - 1})` },
      { status: 400 },
    )
  }

  const newEntry = {
    ...mapsEntry,
    parsed: candidates[body.index],
    selected_candidate_index: body.index,
  }
  const { error: setErr } = await supabase.rpc('sales_lead_runs_set_source', {
    p_run_id: id,
    p_source: 'google_maps',
    p_value: newEntry as unknown as Json,
  })
  if (setErr) return NextResponse.json({ error: setErr.message }, { status: 500 })

  // Recompute master alleen voor Maps-eigen velden (zie FIELD_PRIORITY in
  // master-record.ts: address, coordinates, rating, ratings_total,
  // business_status, opening_hours, business_types, photos_count).
  // Andere user-edits behouden.
  const updatedEnrichments: RunEnrichments = { ...enrichments, google_maps: newEntry }
  const fresh = computePrimaryMaster(updatedEnrichments, run.input_url)
  const existing = (run.master_record ?? {}) as MasterRecord

  const merged: MasterRecord = {
    ...existing,
    address: fresh.address ?? existing.address,
    coordinates: fresh.coordinates ?? existing.coordinates,
    rating: fresh.rating ?? existing.rating,
    ratings_total: fresh.ratings_total ?? existing.ratings_total,
    business_status: fresh.business_status ?? existing.business_status,
    opening_hours: fresh.opening_hours ?? existing.opening_hours,
    business_types: fresh.business_types ?? existing.business_types,
    photos_count: fresh.photos_count ?? existing.photos_count,
  }
  // Maps' company_name kan ook anders zijn — alleen overschrijven als bestaand
  // master nog geen company_name had (anders winnen KvK/Apollo via priority
  // bovenop user-edits).
  if (!existing.company_name && fresh.company_name) {
    merged.company_name = fresh.company_name
  }
  // Idem voor website (Maps levert website van het Google-listing).
  if (!existing.website && fresh.website) {
    merged.website = fresh.website
  }

  merged.deal_note_text = await generateDealNote({
    master: merged,
    selectedVacancies: merged.vacancies ?? [],
    supabase,
  })

  const { error: updErr } = await supabase
    .from('sales_lead_runs')
    .update({ master_record: merged as unknown as Json, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    selected_index: body.index,
    master_record: merged,
  })
}

export const POST = withAuth(handler)
