// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getPipedriveClient } from '@/lib/pipedrive-client'
import { ORG_FIELD_KEYS } from '@/lib/services/sales-leads/pipedrive-fields'
import { invalidateBrancheOptionsCache } from '@/lib/services/sales-leads/branche-options.service'

export const runtime = 'nodejs'
export const maxDuration = 60

type PipedriveFieldOption = { id: number; label: string }
type PipedriveField = {
  key: string
  name: string
  options?: PipedriveFieldOption[]
}

async function handler(_req: NextRequest, _auth: AuthResult) {
  const pd = getPipedriveClient()
  const supabase = createServiceRoleClient()

  const fields = (await pd.listOrganizationFields()) as PipedriveField[]
  const brancheField = fields.find((f) => f.key === ORG_FIELD_KEYS.BRANCHE)
  if (!brancheField || !Array.isArray(brancheField.options)) {
    return NextResponse.json(
      { error: `Branche-veld (key ${ORG_FIELD_KEYS.BRANCHE}) niet gevonden of zonder opties` },
      { status: 502 },
    )
  }

  const pdOptions = brancheField.options
  const pdEnumIds = new Set(pdOptions.map((o) => o.id))
  const now = new Date().toISOString()

  const { data: existing, error: fetchErr } = await supabase
    .from('pipedrive_branche_options')
    .select('pipedrive_enum_id, label, active')
  if (fetchErr) {
    return NextResponse.json({ error: `DB fetch failed: ${fetchErr.message}` }, { status: 500 })
  }
  const existingByEnumId = new Map(existing?.map((r) => [r.pipedrive_enum_id, r]) ?? [])

  let inserted = 0
  let updated = 0
  let deactivated = 0

  for (const opt of pdOptions) {
    const prev = existingByEnumId.get(opt.id)
    if (!prev) {
      const { error } = await supabase.from('pipedrive_branche_options').insert({
        pipedrive_enum_id: opt.id,
        label: opt.label,
        sort_order: 999,
        sbi_prefixes: [],
        active: true,
        synced_from_pipedrive_at: now,
      })
      if (error) {
        return NextResponse.json({ error: `Insert ${opt.id} faalde: ${error.message}` }, { status: 500 })
      }
      inserted++
      continue
    }
    if (prev.label !== opt.label || !prev.active) {
      const { error } = await supabase
        .from('pipedrive_branche_options')
        .update({ label: opt.label, active: true, synced_from_pipedrive_at: now })
        .eq('pipedrive_enum_id', opt.id)
      if (error) {
        return NextResponse.json({ error: `Update ${opt.id} faalde: ${error.message}` }, { status: 500 })
      }
      updated++
    } else {
      await supabase
        .from('pipedrive_branche_options')
        .update({ synced_from_pipedrive_at: now })
        .eq('pipedrive_enum_id', opt.id)
    }
  }

  const toDeactivate = (existing ?? []).filter((r) => r.active && !pdEnumIds.has(r.pipedrive_enum_id))
  for (const row of toDeactivate) {
    // Bij deactivate ook sbi_prefixes leeghalen - voorkomt dat een latere
    // PATCH/sync deze opties weer activeert met overlappende prefixes vs
    // andere actieve branches (silent winner via findEnumIdForSbi).
    const { error } = await supabase
      .from('pipedrive_branche_options')
      .update({ active: false, sbi_prefixes: [], synced_from_pipedrive_at: now })
      .eq('pipedrive_enum_id', row.pipedrive_enum_id)
    if (error) {
      return NextResponse.json({ error: `Deactivate ${row.pipedrive_enum_id} faalde: ${error.message}` }, { status: 500 })
    }
    deactivated++
  }

  invalidateBrancheOptionsCache()

  return NextResponse.json({
    success: true,
    pipedrive_options_count: pdOptions.length,
    inserted,
    updated,
    deactivated,
    synced_at: now,
  })
}

export const POST = withAdminAuth(handler)
