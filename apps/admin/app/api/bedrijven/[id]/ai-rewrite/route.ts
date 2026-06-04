// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { rewriteCompanyDescription } from '@/lib/services/company-description/rewrite.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function aiRewriteHandler(
  req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const sourceText = typeof body?.sourceText === 'string' ? body.sourceText.trim() : ''

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }
    if (!sourceText) {
      return NextResponse.json({ success: false, error: 'Brontekst is verplicht' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, city')
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json({ success: false, error: 'Bedrijf niet gevonden' }, { status: 404 })
    }

    const result = await rewriteCompanyDescription({
      name: company.name,
      city: company.city,
      sourceText,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error in company ai-rewrite:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI herschrijving mislukt' },
      { status: 500 },
    )
  }
}

export const POST = withAuth(aiRewriteHandler)
