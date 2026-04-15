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

async function publishHandler(
  _req: NextRequest,
  authResult: AuthResult,
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

    const { data, error } = await supabase
      .from('job_postings')
      .update({
        review_status: 'approved',
        published_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: authResult.user?.id ?? null,
      })
      .eq('id', id)
      .select('id, slug, platform_id')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Fout bij publiceren', details: error?.message },
        { status: 500 }
      )
    }

    await revalidatePublicSite({
      platformIds: data.platform_id ? [data.platform_id] : [],
      jobSlugs: data.slug ? [data.slug] : [],
    })

    // IndexNow ping — best-effort, never throws.
    if (data.platform_id && data.slug) {
      const { data: platform } = await supabase
        .from('platforms')
        .select('domain, preview_domain, indexnow_key')
        .eq('id', data.platform_id)
        .single()

      const host = platform ? resolvePlatformHost(platform) : null
      if (host && platform?.indexnow_key) {
        const result = await submitToIndexNow({
          host,
          key: platform.indexnow_key,
          urlList: buildVacatureUrlList(host, [data.slug]),
        })
        console.log(
          `[IndexNow] publish vacature=${id} host=${host} ok=${result.ok} status=${result.status ?? 'n/a'} submitted=${result.submitted}`
        )
      } else {
        console.warn(
          `[IndexNow] publish vacature=${id} skipped — platform ${data.platform_id} has no domain or indexnow_key`
        )
      }
    }

    return NextResponse.json({ success: true, data })
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

export const POST = withAuth(publishHandler)
