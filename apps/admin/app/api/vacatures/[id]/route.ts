import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function getVacatureHandler(
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

    const { data: jobPosting, error } = await supabase
      .from('job_postings')
      .select(`
        id,
        title,
        location,
        status,
        review_status,
        created_at,
        scraped_at,
        published_at,
        job_type,
        salary,
        url,
        description,
        company_id,
        source_id,
        platform_id,
        employment,
        career_level,
        education_level,
        working_hours_min,
        working_hours_max,
        categories,
        end_date,
        city,
        zipcode,
        street,
        country,
        slug,
        companies (
          id,
          name,
          website,
          logo_url
        ),
        platforms (
          id,
          regio_platform
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Vacature niet gevonden',
        details: error.message,
      }, { status: 404 })
    }

    // Extract state from location if possible
    const company = jobPosting.companies as { id: string; name: string; website: string | null; logo_url: string | null } | null
    const platform = jobPosting.platforms as { id: string; regio_platform: string } | null

    return NextResponse.json({
      success: true,
      data: {
        ...jobPosting,
        company_name: company?.name,
        regio_platform: platform?.regio_platform,
      },
    })
  } catch (error) {
    console.error('Error in get vacancy API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

async function updateVacatureHandler(
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

    const {
      title,
      company_id,
      city,
      zipcode,
      street,
      state,
      description,
      salary,
      employment,
      working_hours_min,
      working_hours_max,
      education_level,
      categories,
      url,
      end_date,
      platform_id,
      review_status,
    } = body

    // Get current data to check if slug needs regeneration
    const { data: current } = await supabase
      .from('job_postings')
      .select('title, city, slug, review_status, platform_id')
      .eq('id', id)
      .single()

    if (!current) {
      return NextResponse.json({ success: false, error: 'Vacature niet gevonden' }, { status: 404 })
    }

    // Get company name
    let companyName = null
    if (company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', company_id)
        .single()
      companyName = company?.name || null
    }

    // Build location string
    const locationParts = [city, state].filter(Boolean)
    const location = locationParts.join(', ') || null

    // Auto-assign platform via postcode if platform changed to auto
    let finalPlatformId = platform_id || null
    if (!finalPlatformId && zipcode) {
      const postcode = zipcode.substring(0, 4)
      const { data: lookup } = await supabase
        .from('postcode_platform_lookup')
        .select('platform_id')
        .eq('postcode', postcode)
        .order('distance', { ascending: true })
        .limit(1)

      if (lookup && lookup.length > 0) {
        finalPlatformId = lookup[0].platform_id
      }
    }

    const updateFields: Record<string, unknown> = {
      title,
      company_id: company_id || null,
      company_name: companyName,
      city: city || null,
      zipcode: zipcode || null,
      street: street || null,
      location,
      description: description || null,
      salary: salary || null,
      employment: employment || null,
      working_hours_min: working_hours_min ? parseInt(working_hours_min) : null,
      working_hours_max: working_hours_max ? parseInt(working_hours_max) : null,
      education_level: education_level || null,
      categories: categories || null,
      url: url || null,
      end_date: end_date || null,
      platform_id: finalPlatformId,
      review_status: review_status || current.review_status,
      updated_at: new Date().toISOString(),
    }

    // Regenerate slug if title or city changed
    if (title !== current.title || city !== current.city) {
      const titlePart = (title || 'vacature').substring(0, 60).toLowerCase()
      const cityPart = (city || 'onbekend').toLowerCase()
      const idPart = id.replace(/-/g, '').substring(0, 8)
      const rawSlug = `${titlePart}-${cityPart}-${idPart}`
      updateFields.slug = rawSlug
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    // Set published_at if status changed to approved
    if (review_status === 'approved' && current.review_status !== 'approved') {
      updateFields.published_at = new Date().toISOString()
      updateFields.reviewed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('job_postings')
      .update(updateFields)
      .eq('id', id)
      .select('id, slug')
      .single()

    if (error) {
      console.error('Error updating vacancy:', error)
      return NextResponse.json({
        success: false,
        error: 'Fout bij bijwerken vacature',
        details: error.message,
      }, { status: 500 })
    }

    // Update job_posting_platforms junction
    if (finalPlatformId && finalPlatformId !== current.platform_id) {
      // Remove old platform assignment
      if (current.platform_id) {
        await supabase
          .from('job_posting_platforms')
          .delete()
          .eq('job_posting_id', id)
          .eq('platform_id', current.platform_id)
          .catch(() => {})
      }
      // Insert new
      await supabase
        .from('job_posting_platforms')
        .upsert(
          {
            job_posting_id: id,
            platform_id: finalPlatformId,
            is_primary: true,
          },
          { onConflict: 'job_posting_id,platform_id' }
        )
        .catch(() => {})
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Vacature bijgewerkt',
    })
  } catch (error) {
    console.error('Error in update vacancy API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

async function deleteVacatureHandler(
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
      .from('job_postings')
      .update({
        status: 'archived',
        review_status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Error archiving vacancy:', error)
      return NextResponse.json({
        success: false,
        error: 'Fout bij archiveren vacature',
        details: error.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Vacature gearchiveerd',
    })
  } catch (error) {
    console.error('Error in delete vacancy API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export const GET = withAuth(getVacatureHandler)
export const PATCH = withAuth(updateVacatureHandler)
export const DELETE = withAuth(deleteVacatureHandler)
