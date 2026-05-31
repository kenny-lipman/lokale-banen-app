// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function postHandler(request: NextRequest, _authResult: AuthResult) {
  try {
    let body: { ids?: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string' && UUID_REGEX.test(id)) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Geen geldige IDs' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Status-gate: alleen gearchiveerde records activeren. Voorkomt dat
    // actieve records onnodig revalidate triggeren als ze in de bulk-lijst
    // staan.
    const { data, error } = await supabase
      .from('job_postings')
      .update({
        archived_at: null,
        archived_by: null,
        archived_reason: null,
      })
      .in('id', ids)
      .not('archived_at', 'is', null)
      .select('id, slug, platform_id, review_status, published_at')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const activated = data?.length ?? 0

    const slugsByPlatform = new Map<string, string[]>()
    for (const row of data ?? []) {
      if (row.review_status === 'approved' && row.published_at && row.platform_id && row.slug) {
        const list = slugsByPlatform.get(row.platform_id) ?? []
        list.push(row.slug)
        slugsByPlatform.set(row.platform_id, list)
      }
    }

    // Per-platform revalidate zodat sitemap/listings van platform A niet
    // onnodig de slugs van platform B krijgen.
    for (const [platformId, jobSlugs] of slugsByPlatform.entries()) {
      await revalidatePublicSite({
        platformIds: [platformId],
        jobSlugs,
      }).catch((err) =>
        console.error('[bulk-activate] revalidate failed', platformId, err),
      )
    }

    return NextResponse.json({
      success: true,
      activated,
      message: `${activated} vacature(s) geactiveerd`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = withAuth(postHandler)
