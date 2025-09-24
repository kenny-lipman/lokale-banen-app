import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
async function jobPostingsGetHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const { searchParams } = new URL(req.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const status = searchParams.get('status')

    // Build query
    let query = authResult.supabase
      .from('job_postings')
      .select('*', { count: 'exact' })

    // Apply filters
    if (search) {
      query = query.ilike('title', `%${search}%`)
    }
    if (status) {
      query = query.eq('status', status)
    }

    // Execute with pagination
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
      count: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    })
  } catch (error: any) {
    console.error('API Error fetching job postings:', {
      message: error?.message || 'Unknown error',
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      params
    })
    
    return NextResponse.json({
      success: false,
      error: error?.message || 'Failed to fetch job postings',
      details: {
        message: error?.message,
        code: error?.code,
        hint: error?.hint
      }
    }, { status: 500 })
  }
}

export const GET = withAuth(jobPostingsGetHandler)