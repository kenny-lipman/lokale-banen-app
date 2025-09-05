import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  
  const params = {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '10'),
    search: searchParams.get('search') || undefined,
    status: searchParams.get('status') || undefined,
    source_id: searchParams.get('source_id') || undefined,
    platform_id: searchParams.get('platform_id') || undefined,
  }

  try {
    const result = await supabaseService.getJobPostings(params)
    
    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      totalPages: result.totalPages
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