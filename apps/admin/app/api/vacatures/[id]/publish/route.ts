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

    // Fetch current state to auto-generate slug + platform if missing
    const { data: current, error: fetchErr } = await supabase
      .from('job_postings')
      .select('id, title, city, slug, platform_id, zipcode')
      .eq('id', id)
      .single()

    if (fetchErr || !current) {
      return NextResponse.json(
        { success: false, error: 'Vacature niet gevonden' },
        { status: 404 }
      )
    }

    const updatePayload: Record<string, unknown> = {
      review_status: 'approved',
      published_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: authResult.user?.id ?? null,
    }

    // Auto-assign platform via postcode if missing
    // Note: postcode_platform_lookup stores regio_platform (text), not platform_id.
    // We need to join with platforms table to get the UUID.
    let finalPlatformId: string | null = current.platform_id
    if (!finalPlatformId && current.zipcode) {
      const postcode = current.zipcode.substring(0, 4)
      const { data: lookup } = await supabase
        .from('postcode_platform_lookup')
        .select('regio_platform')
        .eq('postcode', postcode)
        .order('distance', { ascending: true })
        .limit(1)
      if (lookup && lookup.length > 0) {
        const { data: platformRow } = await supabase
          .from('platforms')
          .select('id')
          .eq('regio_platform', lookup[0].regio_platform)
          .limit(1)
          .maybeSingle()
        if (platformRow) {
          finalPlatformId = platformRow.id
          updatePayload.platform_id = finalPlatformId
        }
      }
    }

    // Auto-generate slug if missing
    if (!current.slug) {
      const titlePart = (current.title || 'vacature').substring(0, 60).toLowerCase()
      const cityPart = (current.city || 'onbekend').toLowerCase()
      const idPart = id.replace(/-/g, '').substring(0, 8)
      updatePayload.slug = `${titlePart}-${cityPart}-${idPart}`
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    const { data, error } = await supabase
      .from('job_postings')
      .update(updatePayload)
      .eq('id', id)
      .select('id, slug, platform_id')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Fout bij publiceren', details: error?.message },
        { status: 500 }
      )
    }

    // Upsert junction table if platform was auto-assigned
    if (finalPlatformId && !current.platform_id) {
      await supabase
        .from('job_posting_platforms')
        .upsert(
          {
            job_posting_id: id,
            platform_id: finalPlatformId,
            is_primary: true,
          },
          { onConflict: 'job_posting_id,platform_id' }
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
