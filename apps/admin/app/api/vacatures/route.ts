import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function createVacatureHandler(req: NextRequest, _authResult: AuthResult) {
  try {
    const supabase = createServiceRoleClient()
    const body = await req.json()

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
      // New company fields (optional)
      new_company_name,
      new_company_website,
      new_company_city,
    } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'Titel is verplicht' }, { status: 400 })
    }

    let finalCompanyId = company_id

    // Create new company if requested
    if (!finalCompanyId && new_company_name) {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: new_company_name,
          website: new_company_website || null,
          location: new_company_city || null,
        })
        .select('id')
        .single()

      if (companyError) {
        return NextResponse.json({
          success: false,
          error: 'Fout bij aanmaken bedrijf',
          details: companyError.message,
        }, { status: 500 })
      }
      finalCompanyId = newCompany.id
    }

    if (!finalCompanyId) {
      return NextResponse.json({ success: false, error: 'Bedrijf is verplicht' }, { status: 400 })
    }

    // Get company name for location field
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', finalCompanyId)
      .single()

    // Auto-assign platform via postcode if not specified
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

    // Build location string
    const locationParts = [city, state].filter(Boolean)
    const location = locationParts.join(', ') || null

    // Insert job posting
    const { data: jobPosting, error: insertError } = await supabase
      .from('job_postings')
      .insert({
        title,
        company_id: finalCompanyId,
        company_name: company?.name || null,
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
        review_status: review_status || 'pending',
        status: 'active',
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select('id, title, city')
      .single()

    if (insertError) {
      console.error('Error creating vacancy:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Fout bij aanmaken vacature',
        details: insertError.message,
      }, { status: 500 })
    }

    // Generate slug
    const titlePart = (jobPosting.title || 'vacature').substring(0, 60).toLowerCase()
    const cityPart = (jobPosting.city || 'onbekend').toLowerCase()
    const idPart = jobPosting.id.replace(/-/g, '').substring(0, 8)
    const rawSlug = `${titlePart}-${cityPart}-${idPart}`
    const slug = rawSlug
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Update with slug and published_at if approved
    const updateFields: Record<string, unknown> = { slug }
    if (review_status === 'approved') {
      updateFields.published_at = new Date().toISOString()
      updateFields.reviewed_at = new Date().toISOString()
    }

    await supabase
      .from('job_postings')
      .update(updateFields)
      .eq('id', jobPosting.id)

    // Insert job_posting_platforms junction record if platform assigned
    if (finalPlatformId) {
      await supabase
        .from('job_posting_platforms')
        .upsert(
          {
            job_posting_id: jobPosting.id,
            platform_id: finalPlatformId,
            is_primary: true,
          },
          { onConflict: 'job_posting_id,platform_id' }
        )
        .catch(() => {
          // Ignore if upsert fails
        })
    }

    return NextResponse.json({
      success: true,
      data: { id: jobPosting.id, slug },
      message: 'Vacature aangemaakt',
    })
  } catch (error) {
    console.error('Error in create vacancy API:', error)
    return NextResponse.json({
      success: false,
      error: 'Interne serverfout',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export const POST = withAuth(createVacatureHandler)
