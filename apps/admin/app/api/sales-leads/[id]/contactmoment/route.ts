import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const patchSchema = z.object({
  contactmoment_override: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum moet YYYY-MM-DD zijn')
    .nullable(),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_runs')
    .update({
      contactmoment_override: parsed.data.contactmoment_override,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, contactmoment_override')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Run niet gevonden' }, { status: 404 })

  return NextResponse.json({ contactmoment_override: data.contactmoment_override })
}

export const PATCH = withAuth(handler)
