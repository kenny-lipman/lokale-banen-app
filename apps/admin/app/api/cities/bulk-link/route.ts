// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { bulkLinkSchema } from '@/lib/cities/schemas'

async function handler(req: NextRequest, auth: AuthResult) {
  const raw = await req.json().catch(() => null)
  const parsed = bulkLinkSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { ids, platform_id, activate } = parsed.data

  const update: Record<string, unknown> = {}
  if ('platform_id' in parsed.data) update.platform_id = platform_id ?? null
  if (typeof activate === 'boolean') update.is_active = activate

  // Eerste poging: 1 query voor alle ids (fast path)
  const { error: bulkError, count } = await auth.supabase
    .from('cities')
    .update(update, { count: 'exact' })
    .in('id', ids)

  if (!bulkError) {
    return NextResponse.json({ updated: count ?? ids.length, failed: [] })
  }

  // Fout (waarschijnlijk 23505 conflict op (plaats, postcode, platform_id))
  // → val terug op per-id update zodat we per rij rapporteren
  if (bulkError.code !== '23505') {
    console.error('cities bulk-link unexpected error:', bulkError)
    return NextResponse.json({ error: bulkError.message }, { status: 500 })
  }

  const failed: Array<{ id: string; error: string }> = []
  let updated = 0
  for (const id of ids) {
    const { error } = await auth.supabase.from('cities').update(update).eq('id', id)
    if (error) {
      failed.push({
        id,
        error: error.code === '23505' ? 'duplicate_combination' : (error.message || 'unknown'),
      })
    } else {
      updated++
    }
  }
  return NextResponse.json({ updated, failed })
}

export const POST = withAdminAuth(handler)
