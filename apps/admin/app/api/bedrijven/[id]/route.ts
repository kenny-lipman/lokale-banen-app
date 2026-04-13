import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function getBedrijfHandler(
  req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .select(`
        id,
        name,
        website,
        description,
        logo_url,
        linkedin_url,
        kvk_number,
        street,
        city,
        zipcode,
        state,
        country,
        phone,
        industry,
        size_min,
        size_max,
        location,
        status,
        is_customer,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Bedrijf niet gevonden',
        details: error.message,
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: company,
    })
  } catch (error) {
    console.error('Error in get company API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

async function updateBedrijfHandler(
  req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params
    const body = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }

    // Field allowlist to prevent unauthorized field updates
    const allowedFields = [
      'name', 'website', 'description', 'logo_url', 'linkedin_url',
      'kvk_number', 'street', 'city', 'zipcode', 'state', 'country',
      'phone', 'industry', 'size_min', 'size_max',
    ]
    const sanitizedBody = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowedFields.includes(key))
    )

    if (!sanitizedBody.name) {
      return NextResponse.json({ success: false, error: 'Naam is verplicht' }, { status: 400 })
    }

    // Build location string
    const locationParts = [sanitizedBody.city, sanitizedBody.state].filter(Boolean)
    const location = locationParts.join(', ') || null

    // Normalize optional fields
    const updates: Record<string, unknown> = {
      name: sanitizedBody.name,
      website: sanitizedBody.website || null,
      description: sanitizedBody.description || null,
      logo_url: sanitizedBody.logo_url || null,
      linkedin_url: sanitizedBody.linkedin_url || null,
      kvk_number: sanitizedBody.kvk_number || null,
      street: sanitizedBody.street || null,
      city: sanitizedBody.city || null,
      zipcode: sanitizedBody.zipcode || null,
      state: sanitizedBody.state || null,
      country: sanitizedBody.country || 'NL',
      phone: sanitizedBody.phone || null,
      industry: sanitizedBody.industry || null,
      size_min: sanitizedBody.size_min ? parseInt(sanitizedBody.size_min) : null,
      size_max: sanitizedBody.size_max ? parseInt(sanitizedBody.size_max) : null,
      location,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select('id, name')
      .single()

    if (error) {
      console.error('Error updating company:', error)
      return NextResponse.json({
        success: false,
        error: 'Fout bij bijwerken bedrijf',
        details: error.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Bedrijf bijgewerkt',
    })
  } catch (error) {
    console.error('Error in update company API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

async function deleteBedrijfHandler(
  req: NextRequest,
  _authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is verplicht' }, { status: 400 })
    }

    // Soft delete: set status to archived
    const { error } = await supabase
      .from('companies')
      .update({
        status: 'Archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Error archiving company:', error)
      return NextResponse.json({
        success: false,
        error: 'Fout bij archiveren bedrijf',
        details: error.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Bedrijf gearchiveerd',
    })
  } catch (error) {
    console.error('Error in delete company API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export const GET = withAuth(getBedrijfHandler)
export const PATCH = withAuth(updateBedrijfHandler)
export const DELETE = withAuth(deleteBedrijfHandler)
