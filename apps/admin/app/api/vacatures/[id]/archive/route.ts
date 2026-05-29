// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function archiveHandler(
  req: NextRequest,
  authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Ongeldig ID' },
        { status: 400 }
      )
    }

    let reason: string | null = null
    try {
      const body = await req.json().catch(() => ({}))
      if (typeof body?.reason === 'string' && body.reason.trim().length > 0) {
        reason = body.reason.trim()
      }
    } catch {
      /* empty body OK */
    }

    const supabase = createServiceRoleClient()
    // Status-gate: alleen niet-gearchiveerde records archiveren. Beschermt audit
    // trail en grace-period bij dubbele klik / race condition.
    const { data, error } = await supabase
      .from('job_postings')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: authResult.user?.id ?? null,
        archived_reason: reason,
      })
      .eq('id', id)
      .is('archived_at', null)
      .select('id, slug, platform_id, review_status, published_at')
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Vacature niet gevonden of al gearchiveerd' },
        { status: 409 }
      )
    }

    if (data.review_status === 'approved' && data.published_at && data.platform_id) {
      await revalidatePublicSite({
        platformIds: [data.platform_id],
        jobSlugs: data.slug ? [data.slug] : [],
      }).catch((err) => console.error('[archive] revalidate failed', err))
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[archive] error', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Onbekende fout' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(archiveHandler)
