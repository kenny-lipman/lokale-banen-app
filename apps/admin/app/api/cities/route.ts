// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { uuidSchema } from '@/lib/cities/schemas'

const createCitySchema = z.object({
  plaats: z.string().trim().min(1).max(120),
  postcode: z.string().trim().regex(/^\d{4}$/, 'postcode moet 4 cijfers zijn'),
  platform_id: uuidSchema.nullable().optional(),
  is_active: z.boolean().optional().default(false),
})

async function postHandler(req: NextRequest, auth: AuthResult) {
  const raw = await req.json().catch(() => null)
  const parsed = createCitySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { plaats, postcode, platform_id, is_active } = parsed.data

  const { data, error } = await auth.supabase
    .from('cities')
    .insert({
      plaats,
      postcode,
      platform_id: platform_id ?? null,
      is_active,
      source: 'manual',
    })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', message: 'Deze plaats/postcode/platform-combinatie bestaat al' },
        { status: 409 },
      )
    }
    console.error('cities POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ city: data }, { status: 201 })
}

export const POST = withAdminAuth(postHandler)
