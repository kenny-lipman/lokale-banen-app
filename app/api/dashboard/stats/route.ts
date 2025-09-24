import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

async function dashboardStatsHandler(req: NextRequest, authResult: AuthResult) {
  try {
    // Get total jobs
    const { count: totalJobs } = await authResult.supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })

    // Get total companies
    const { count: totalCompanies } = await authResult.supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })

    // Get today's jobs (created today)
    const today = new Date().toISOString().split('T')[0]
    const { count: todayJobs } = await authResult.supabase
      .from('job_postings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    return NextResponse.json({
      totalJobs: totalJobs || 0,
      totalCompanies: totalCompanies || 0,
      todayJobs: todayJobs || 0,
      success: true
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(dashboardStatsHandler)