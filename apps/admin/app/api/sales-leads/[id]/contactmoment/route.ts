import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

// Vandaag in TZ Europe/Amsterdam als YYYY-MM-DD (cron werkt op UTC; sales kiest
// werkdagen). Een datum die NU al gisteren is wordt geweigerd; vandaag zelf mag.
function todayInAmsterdam(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(new Date()) // 'YYYY-MM-DD'
}

const patchSchema = z.object({
  contactmoment_override: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum moet YYYY-MM-DD zijn')
    .refine((d) => d >= todayInAmsterdam(), 'Contactmoment mag niet in het verleden liggen')
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
