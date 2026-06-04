// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { fetchCompanySource } from '@/lib/services/company-description/source.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function aiSourceHandler(
  _req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json({ success: false, error: 'Bedrijf niet gevonden' }, { status: 404 })
    }

    const source = await fetchCompanySource(supabase, {
      companyId: company.id,
      website: company.website,
    })

    if (!source.websiteText && source.vacancyTitles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Geen bron beschikbaar voor dit bedrijf' },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, data: source })
  } catch (error) {
    console.error('Error in company ai-source:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Bron ophalen mislukt' },
      { status: 500 },
    )
  }
}

export const POST = withAuth(aiSourceHandler)
