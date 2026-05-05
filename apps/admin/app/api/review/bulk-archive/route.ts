import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function postHandler(request: NextRequest, authResult: AuthResult) {
  try {
    let body: { ids?: string[]; reason?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && UUID_REGEX.test(id)) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Geen geldige IDs' }, { status: 400 })
    }

    const reason = typeof body.reason === 'string' && body.reason.trim().length > 0
      ? body.reason.trim()
      : null

    const supabase = createServiceRoleClient()
    const nowIso = new Date().toISOString()

    // Status-gate: alleen niet-gearchiveerde records archiveren. Voorkomt
    // dat al-gearchiveerde records hun audit trail (archived_by/reason) en
    // grace-period kwijtraken bij accidentele dubbele archief.
    const { data, error } = await supabase
      .from('job_postings')
      .update({
        archived_at: nowIso,
        archived_by: authResult.user?.id ?? null,
        archived_reason: reason,
      })
      .in('id', ids)
      .is('archived_at', null)
      .select('id, slug, platform_id, review_status, published_at')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const archived = data?.length ?? 0

    // Per-platform revalidate voor approved+published vacatures
    const slugsByPlatform = new Map<string, string[]>()
    for (const row of data ?? []) {
      if (row.review_status === 'approved' && row.published_at && row.platform_id && row.slug) {
        const list = slugsByPlatform.get(row.platform_id) ?? []
        list.push(row.slug)
        slugsByPlatform.set(row.platform_id, list)
      }
    }

    // Per-platform revalidate zodat sitemap/listings van platform A niet
    // onnodig de slugs van platform B krijgen — voorkomt overrevalidate.
    for (const [platformId, jobSlugs] of slugsByPlatform.entries()) {
      await revalidatePublicSite({
        platformIds: [platformId],
        jobSlugs,
      }).catch((err) =>
        console.error('[bulk-archive] revalidate failed', platformId, err),
      )
    }

    return NextResponse.json({
      success: true,
      archived,
      message: `${archived} vacature(s) gearchiveerd`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
