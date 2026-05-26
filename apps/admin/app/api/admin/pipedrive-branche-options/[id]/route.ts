import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { invalidateBrancheOptionsCache } from '@/lib/services/sales-leads/branche-options.service'

export const runtime = 'nodejs'

const patchSchema = z.object({
  sbi_prefixes: z.array(z.string().regex(/^\d{2}$/, 'SBI-prefix moet 2 cijfers zijn')).optional(),
  active: z.boolean().optional(),
}).refine((v) => v.sbi_prefixes !== undefined || v.active !== undefined, {
  message: 'Geef minstens sbi_prefixes of active mee',
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const update: { sbi_prefixes?: string[]; active?: boolean } = {}
  if (parsed.data.sbi_prefixes !== undefined) {
    update.sbi_prefixes = Array.from(new Set(parsed.data.sbi_prefixes)).sort()
  }
  if (parsed.data.active !== undefined) {
    update.active = parsed.data.active
  }

  // Overlap-check: voorkom dat 2 actieve branches dezelfde SBI-prefix claimen
  // (findEnumIdForSbi pakt dan silent de eerste in sort_order). Bij PATCH met
  // nieuwe prefixes - of bij re-activate van bestaande prefixes - controleer dat
  // geen andere actieve branche al een van deze prefixes heeft.
  const prefixesAfter = update.sbi_prefixes
  const willBeActive = update.active !== undefined
    ? update.active
    : true // niet meegegeven = blijft huidige waarde, verifieer hieronder
  if (prefixesAfter && prefixesAfter.length > 0) {
    const { data: conflicts } = await supabase
      .from('pipedrive_branche_options')
      .select('id, label, sbi_prefixes')
      .neq('id', id)
      .eq('active', true)
      .overlaps('sbi_prefixes', prefixesAfter)
    if (conflicts && conflicts.length > 0 && willBeActive) {
      const offender = conflicts[0]
      const overlapping = offender.sbi_prefixes.filter((p) => prefixesAfter.includes(p))
      return NextResponse.json(
        {
          error: `SBI-prefix(es) ${overlapping.join(', ')} al in gebruik door "${offender.label}". Verwijder daar eerst om dubbele mapping te voorkomen.`,
        },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('pipedrive_branche_options')
    .update(update)
    .eq('id', id)
    .select('id, pipedrive_enum_id, label, sort_order, sbi_prefixes, active, synced_from_pipedrive_at, updated_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  }

  invalidateBrancheOptionsCache()
  return NextResponse.json({ option: data })
}

export const PATCH = withAdminAuth(handler)
