import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'

/**
 * GET /api/lokalebanen/mappings?type=domain|sector|employment|education
 * Fetch mappings, optionally filtered by type
 */
async function getHandler(req: NextRequest, authResult: AuthResult) {
  const { supabase } = authResult
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  let query = supabase
    .from('lokalebanen_mappings')
    .select('*')
    .order('our_value', { ascending: true })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, mappings: data })
}

/**
 * PUT /api/lokalebanen/mappings
 * Upsert a mapping: { type, our_value, their_value }
 */
async function putHandler(req: NextRequest, authResult: AuthResult) {
  const { supabase } = authResult
  const body = await req.json()
  const { type, our_value, their_value } = body

  if (!type || !our_value) {
    return NextResponse.json({ success: false, error: 'type and our_value are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('lokalebanen_mappings')
    .upsert(
      { type, our_value, their_value, updated_at: new Date().toISOString() },
      { onConflict: 'type,our_value' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, mapping: data })
}

/**
 * DELETE /api/lokalebanen/mappings
 * Delete a mapping by id: { id }
 */
async function deleteHandler(req: NextRequest, authResult: AuthResult) {
  const { supabase } = authResult
  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('lokalebanen_mappings')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const GET = withAuth(getHandler)
export const PUT = withAuth(putHandler)
export const DELETE = withAuth(deleteHandler)
