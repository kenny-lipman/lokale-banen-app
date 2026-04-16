import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

async function restoreHandler(
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

    // Verify the job exists and is archived/rejected
    const { data: current, error: fetchError } = await supabase
      .from('job_postings')
      .select('id, status, review_status')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json(
        { success: false, error: 'Vacature niet gevonden' },
        { status: 404 }
      )
    }

    if (current.status !== 'archived' && current.review_status !== 'rejected') {
      return NextResponse.json(
        { success: false, error: 'Vacature is niet gearchiveerd' },
        { status: 400 }
      )
    }

    // Restore: set status back to active, review_status to pending
    const { error: updateError } = await supabase
      .from('job_postings')
      .update({
        status: 'active',
        review_status: 'pending',
        published_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error restoring vacancy:', updateError)
      return NextResponse.json(
        { success: false, error: 'Herstellen mislukt', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Vacature hersteld naar review',
    })
  } catch (error) {
    console.error('Error in restore vacancy API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Interne serverfout',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(restoreHandler)
