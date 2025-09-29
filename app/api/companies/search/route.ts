import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function searchCompaniesHandler(req: NextRequest, authResult: AuthResult) {
  console.log(`🔍 Company search requested by user: ${authResult.user.email}`)

  const url = new URL(req.url)
  const search = url.searchParams.get('search') || ''
  const limit = parseInt(url.searchParams.get('limit') || '100')

  console.log(`🔍 Search params: search="${search}", limit=${limit}`)

  try {
    let query = authResult.supabase
      .from('companies')
      .select('id, name')
      .order('name')
      .limit(limit)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('🔥 Supabase query error:', error)
      throw error
    }

    console.log(`✅ Found ${data?.length || 0} companies`)

    return NextResponse.json({
      success: true,
      companies: data || []
    })

  } catch (error) {
    console.error('Company search failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search companies'
      },
      { status: 500 }
    )
  }
}

export const GET = withAuth(searchCompaniesHandler)