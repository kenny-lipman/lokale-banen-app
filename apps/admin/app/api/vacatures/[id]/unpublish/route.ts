import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

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
