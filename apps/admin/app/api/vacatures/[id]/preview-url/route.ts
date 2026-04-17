import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { generatePreviewToken } from '@lokale-banen/shared'

export const dynamic = 'force-dynamic'

async function previewUrlHandler(
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

    // Get platform for the job so we know which host to preview on
    const { data: job, error } = await supabase
      .from('job_postings')
      .select(`
        id,
        platforms!job_postings_platform_id_fkey (
          id, domain, preview_domain
        )
      `)
      .eq('id', id)
      .single()

    if (error || !job) {
      return NextResponse.json(
        { success: false, error: 'Vacature niet gevonden' },
        { status: 404 }
      )
    }

    const platform = job.platforms as {
      id: string
      domain: string | null
      preview_domain: string | null
    } | null

    // Fallback: if platform has no domain configured, use the main
    // public-sites Vercel alias. The preview route accepts a ?platform=
    // query param to render with that tenant's theme regardless of host.
    const FALLBACK_HOST = 'lokale-banen-public.vercel.app'
    const host = platform?.preview_domain ?? platform?.domain ?? FALLBACK_HOST
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')

    const token = generatePreviewToken(id)
    const queryParams = new URLSearchParams({ token })
    // Pass platform id so preview page can apply correct tenant theme
    // when the host is the fallback (multi-tenant-unaware) domain.
    if (platform?.id) queryParams.set('platform', platform.id)

    const url = `https://${cleanHost}/preview/${id}?${queryParams.toString()}`

    return NextResponse.json({
      success: true,
      data: {
        url,
        expiresInMinutes: 60,
        usedFallback: !platform?.preview_domain && !platform?.domain,
      },
    })
  } catch (error) {
    console.error('Error generating preview URL:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Preview URL genereren mislukt',
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(previewUrlHandler)
