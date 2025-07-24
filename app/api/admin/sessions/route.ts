import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // TODO: Add proper admin authentication check
    // For now, we'll allow access but this should be secured
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    
    // Calculate offset
    const offset = (page - 1) * limit
    
    // Build query
    let query = supabase
      .from('otis_workflow_sessions')
      .select(`
        id,
        session_id,
        user_id,
        status,
        current_stage,
        created_at,
        completed_at,
        total_jobs,
        total_companies,
        total_contacts,
        total_campaigns,
        profiles!inner(
          full_name,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    if (status) {
      query = query.eq('status', status)
    }
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }
    
    // Execute query
    const { data: sessions, error, count } = await query
    
    if (error) {
      console.error('Error fetching admin sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }
    
    // Calculate duration and format data
    const sessionsWithDuration = sessions?.map(session => ({
      id: session.id,
      session_id: session.session_id,
      user_id: session.user_id,
      user_name: session.profiles?.full_name || 'Unknown User',
      user_role: session.profiles?.role || 'user',
      status: session.status,
      current_stage: session.current_stage,
      created_at: session.created_at,
      completed_at: session.completed_at,
      total_jobs: session.total_jobs,
      total_companies: session.total_companies,
      total_contacts: session.total_contacts,
      total_campaigns: session.total_campaigns,
      duration_minutes: session.completed_at 
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.created_at!).getTime()) / (1000 * 60))
        : Math.round((Date.now() - new Date(session.created_at!).getTime()) / (1000 * 60))
    })) || []
    
    // Get system-wide analytics
    const { data: analytics, error: analyticsError } = await supabase
      .from('otis_workflow_sessions')
      .select('status, total_jobs, total_companies, total_contacts, total_campaigns')
    
    if (analyticsError) {
      console.error('Error fetching analytics:', analyticsError)
    }
    
    // Calculate analytics
    const totalSessions = analytics?.length || 0
    const completedSessions = analytics?.filter(s => s.status === 'completed').length || 0
    const successRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0
    
    const totalJobs = analytics?.reduce((sum, s) => sum + (s.total_jobs || 0), 0) || 0
    const totalCompanies = analytics?.reduce((sum, s) => sum + (s.total_companies || 0), 0) || 0
    const totalContacts = analytics?.reduce((sum, s) => sum + (s.total_contacts || 0), 0) || 0
    const totalCampaigns = analytics?.reduce((sum, s) => sum + (s.total_campaigns || 0), 0) || 0
    
    return NextResponse.json({
      sessions: sessionsWithDuration,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      analytics: {
        totalSessions,
        completedSessions,
        successRate: Math.round(successRate * 100) / 100,
        totalJobs,
        totalCompanies,
        totalContacts,
        totalCampaigns
      }
    })
    
  } catch (error) {
    console.error('Unexpected error in admin sessions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 