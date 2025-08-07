import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    
    let query = supabase
      .from('companies')
      .select(`
        id,
        name,
        website,
        location,
        is_customer,
        status,
        created_at,
        logo_url,
        rating_indeed,
        review_count_indeed,
        size_min,
        size_max,
        category_size,
        description,
        qualification_status,
        qualification_timestamp,
        qualification_notes
      `, { count: 'exact' })

    // Add search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,website.ilike.%${search}%,location.ilike.%${search}%`)
    }

    // Add status filter
    if (status) {
      query = query.eq('status', status)
    }

    // Add pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // Order by created_at descending
    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching companies:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in companies API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    
    const { companyId, status } = body

    if (!companyId || !status) {
      return NextResponse.json({ error: 'Company ID and status are required' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['Prospect', 'Qualified', 'Disqualified', 'Customer']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status. Must be one of: Prospect, Qualified, Disqualified, Customer' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('companies')
      .update({ status })
      .eq('id', companyId)
      .select('id, name, status')
      .single()

    if (error) {
      console.error('Error updating company status:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        name: data.name,
        status: data.status
      }
    })

  } catch (error) {
    console.error('Error in companies PATCH API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 