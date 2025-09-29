import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function searchContactsHandler(req: NextRequest, authResult: AuthResult) {

  const url = new URL(req.url)
  const companyId = url.searchParams.get('company_id')
  const search = url.searchParams.get('search') || ''
  const limit = parseInt(url.searchParams.get('limit') || '100')

  try {
    let query = authResult.supabase
      .from('contacts')
      .select('id, name, email, company_id')
      .order('name')
      .limit(limit)

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      contacts: data || []
    })

  } catch (error) {
    console.error('Contact search failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search contacts'
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(searchContactsHandler)