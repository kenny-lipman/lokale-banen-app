import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function jobSourcesHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const { data: sources, error } = await authResult.supabase
      .from('job_sources')
      .select('*')
      .order('name')

    if (error) {
      throw error
    }

    return NextResponse.json({
      sources: sources || [],
      success: true
    })
  } catch (error) {
    console.error('Error fetching job sources:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job sources' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(jobSourcesHandler)