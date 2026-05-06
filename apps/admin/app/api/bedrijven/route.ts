import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/supabase'

type CompanyInsert = Database['public']['Tables']['companies']['Insert']

async function createBedrijfHandler(req: NextRequest, _authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const body = await req.json()

    const {
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
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Naam is verplicht' }, { status: 400 })
    }

    // Build location string
    const locationParts = [city, state].filter(Boolean)
    const location = locationParts.join(', ') || null

    const insertData: CompanyInsert = {
      name,
      website: website || null,
      description: description || null,
      logo_url: logo_url || null,
      linkedin_url: linkedin_url || null,
      kvk: kvk_number || null,
      street_address: street || null,
      city: city || null,
      postal_code: zipcode || null,
      state: state || null,
      country: country || 'NL',
      phone: phone || null,
      size_min: size_min ? parseInt(size_min) : null,
      size_max: size_max ? parseInt(size_max) : null,
      location,
      status: 'Prospect',
      created_at: new Date().toISOString(),
    }

    const { data: company, error } = await supabase
      .from('companies')
      .insert(insertData)
      .select('id, name')
      .single()

    if (error) {
      console.error('Error creating company:', error)
      return NextResponse.json({
        success: false,
        error: 'Fout bij aanmaken bedrijf',
        details: error.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: company,
      message: 'Bedrijf aangemaakt',
    })
  } catch (error) {
    console.error('Error in create company API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export const POST = withAuth(createBedrijfHandler)
