import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'
import {
  submitToIndexNow,
  resolvePlatformHost,
  buildVacatureUrlList,
} from '@/lib/services/indexnow.service'

export const dynamic = 'force-dynamic'

async function unpublishHandler(
  _req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is verplicht' },
        { status: 400 }
      )
    }

    // Capture slug + platform before unpublishing so we can invalidate cache
    const { data: before } = await supabase
      .from('job_postings')
      .select('slug, platform_id')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('job_postings')
      .update({ published_at: null })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Fout bij depubliceren', details: error.message },
        { status: 500 }
      )
    }

    await revalidatePublicSite({
      platformIds: before?.platform_id ? [before.platform_id] : [],
      jobSlugs: before?.slug ? [before.slug] : [],
    })

    // IndexNow ping — tells search engines the URL is gone / index must refresh.
    // Best-effort, never throws.
    if (before?.platform_id && before.slug) {
      const { data: platform } = await supabase
        .from('platforms')
        .select('domain, preview_domain, indexnow_key')
        .eq('id', before.platform_id)
        .single()

      const host = platform ? resolvePlatformHost(platform) : null
      if (host && platform?.indexnow_key) {
        const result = await submitToIndexNow({
          host,
          key: platform.indexnow_key,
          urlList: buildVacatureUrlList(host, [before.slug]),
        })
        console.log(
          `[IndexNow] unpublish vacature=${id} host=${host} ok=${result.ok} status=${result.status ?? 'n/a'} submitted=${result.submitted}`
        )
      } else {
        console.warn(
          `[IndexNow] unpublish vacature=${id} skipped — platform ${before.platform_id} has no domain or indexnow_key`
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: 'Interne serverfout',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(unpublishHandler)
