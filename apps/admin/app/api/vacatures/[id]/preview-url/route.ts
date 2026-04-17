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

    if (!platform) {
      return NextResponse.json(
        { success: false, error: 'Geen platform gekoppeld aan deze vacature' },
        { status: 400 }
      )
    }

    const host = platform.preview_domain ?? platform.domain
    if (!host) {
      return NextResponse.json(
        { success: false, error: 'Platform heeft geen domain geconfigureerd' },
        { status: 400 }
      )
    }

    const token = generatePreviewToken(id)
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const url = `https://${cleanHost}/preview/${id}?token=${token}`

    return NextResponse.json({
      success: true,
      data: { url, expiresInMinutes: 60 },
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
