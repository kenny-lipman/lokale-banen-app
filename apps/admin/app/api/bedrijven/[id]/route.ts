// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/supabase'

type CompanyUpdate = Database['public']['Tables']['companies']['Update']

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
      .select('*')
      .eq('id', id)
      .single()

    if (error || !company) {
      return NextResponse.json({
        success: false,
        error: 'Bedrijf niet gevonden',
        details: error?.message,
      }, { status: 404 })
    }

    // De UI-form gebruikt single-string `industry`, `kvk_number`, `street`, `zipcode` —
    // remap zodat de bewerken-pagina ongewijzigd blijft. DB heeft `industries: text[]`,
    // `kvk`, `street_address`, `postal_code`.
    const data = {
      id: company.id,
      name: company.name,
      website: company.website,
      description: company.description,
      logo_url: company.logo_url,
      linkedin_url: company.linkedin_url,
      kvk_number: company.kvk,
      street: company.street_address,
      city: company.city,
      zipcode: company.postal_code,
      state: company.state,
      country: company.country,
      phone: company.phone,
      industry: company.industries?.[0] ?? null,
      size_min: company.size_min,
      size_max: company.size_max,
      location: company.location,
      status: company.status,
      is_customer: company.is_customer,
      created_at: company.created_at,
    }

    return NextResponse.json({
      success: true,
      data,
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

    // UI stuurt single-string `industry`; DB-kolom is `industries: text[]`
    const industryStr = (sanitizedBody.industry as string)?.trim()

    // Normalize optional fields
    const updates: CompanyUpdate = {
      name: sanitizedBody.name as string,
      website: (sanitizedBody.website as string) || null,
      description: (sanitizedBody.description as string) || null,
      logo_url: (sanitizedBody.logo_url as string) || null,
      linkedin_url: (sanitizedBody.linkedin_url as string) || null,
      kvk: (sanitizedBody.kvk_number as string) || null,
      street_address: (sanitizedBody.street as string) || null,
      city: (sanitizedBody.city as string) || null,
      postal_code: (sanitizedBody.zipcode as string) || null,
      state: (sanitizedBody.state as string) || null,
      country: (sanitizedBody.country as string) || 'NL',
      phone: (sanitizedBody.phone as string) || null,
      industries: industryStr ? [industryStr] : null,
      size_min: sanitizedBody.size_min ? parseInt(sanitizedBody.size_min as string) : null,
      size_max: sanitizedBody.size_max ? parseInt(sanitizedBody.size_max as string) : null,
      location,
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
      .update({ status: 'Archived' })
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
