import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { revalidatePublicSite } from '@/lib/services/public-site-revalidate.service'

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
        content_md,
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
        state,
        country,
        slug,
        header_image_url,
        seo_title,
        seo_description,
        content_enriched_at,
        companies (
          id,
          name,
          website,
          logo_url
        ),
        platforms!job_postings_platform_id_fkey (
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

    // PARTIAL UPDATE: only write fields that are explicitly present in the body.
    // `undefined` = field not sent = leave DB value untouched
    // `null` or empty string = field explicitly cleared = write null to DB
    // This prevents accidental data wipes when a partial payload is sent
    // (e.g. AI rewrite panel sending only content_md).
    const hasField = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

    // Get current data to check if slug needs regeneration
    const { data: current } = await supabase
      .from('job_postings')
      .select('title, city, slug, review_status, platform_id, zipcode, state')
      .eq('id', id)
      .single()

    if (!current) {
      return NextResponse.json({ success: false, error: 'Vacature niet gevonden' }, { status: 404 })
    }

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Simple string fields — null if empty, skip if not sent
    if (hasField('title')) updateFields.title = body.title
    if (hasField('company_id')) updateFields.company_id = body.company_id || null
    if (hasField('city')) updateFields.city = body.city || null
    if (hasField('zipcode')) updateFields.zipcode = body.zipcode || null
    if (hasField('street')) updateFields.street = body.street || null
    if (hasField('state')) updateFields.state = body.state || null
    if (hasField('description')) updateFields.description = body.description || null
    if (hasField('salary')) updateFields.salary = body.salary || null
    if (hasField('employment')) updateFields.employment = body.employment || null
    if (hasField('education_level')) updateFields.education_level = body.education_level || null
    if (hasField('categories')) updateFields.categories = body.categories || null
    if (hasField('url')) updateFields.url = body.url || null
    if (hasField('end_date')) updateFields.end_date = body.end_date || null
    if (hasField('review_status') && body.review_status) updateFields.review_status = body.review_status
    if (hasField('header_image_url')) updateFields.header_image_url = body.header_image_url
    if (hasField('seo_title')) updateFields.seo_title = body.seo_title || null
    if (hasField('seo_description')) updateFields.seo_description = body.seo_description || null

    // Numeric fields
    if (hasField('working_hours_min')) {
      updateFields.working_hours_min = body.working_hours_min ? parseInt(body.working_hours_min) : null
    }
    if (hasField('working_hours_max')) {
      updateFields.working_hours_max = body.working_hours_max ? parseInt(body.working_hours_max) : null
    }

    // content_md: auto-set enrichment timestamp when written
    if (hasField('content_md')) {
      updateFields.content_md = body.content_md || null
      if (body.content_md) updateFields.content_enriched_at = new Date().toISOString()
    }

    // Rebuild location if city or state is being updated
    if (hasField('city') || hasField('state')) {
      const cityVal = hasField('city') ? body.city : current.city
      const stateVal = hasField('state') ? body.state : (current as { state?: string | null }).state ?? null
      const locationParts = [cityVal, stateVal].filter(Boolean)
      updateFields.location = locationParts.join(', ') || null
    }

    // Platform: auto-assign via postcode if not explicitly set
    let finalPlatformId: string | null = current.platform_id
    if (hasField('platform_id')) {
      finalPlatformId = body.platform_id || null
      // If cleared and zipcode available, auto-assign
      const zipcodeVal = hasField('zipcode') ? body.zipcode : (current as { zipcode?: string | null }).zipcode
      if (!finalPlatformId && zipcodeVal) {
        const postcode = zipcodeVal.substring(0, 4)
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
      updateFields.platform_id = finalPlatformId
    }

    // Regenerate slug only if title or city was explicitly changed
    const titleChanged = hasField('title') && body.title !== current.title
    const cityChanged = hasField('city') && body.city !== current.city
    if (titleChanged || cityChanged) {
      const titleVal = hasField('title') ? body.title : current.title
      const cityVal = hasField('city') ? body.city : current.city
      const titlePart = (titleVal || 'vacature').substring(0, 60).toLowerCase()
      const cityPart = (cityVal || 'onbekend').toLowerCase()
      const idPart = id.replace(/-/g, '').substring(0, 8)
      const rawSlug = `${titlePart}-${cityPart}-${idPart}`
      updateFields.slug = rawSlug
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    }

    // Set published_at if status changed to approved
    if (hasField('review_status') && body.review_status === 'approved' && current.review_status !== 'approved') {
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

    // Update job_posting_platforms junction — only if platform was touched
    if (hasField('platform_id') && finalPlatformId && finalPlatformId !== current.platform_id) {
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

    // Invalidate public-site cache for both old and new platform + slug
    const platformIds = [current.platform_id, finalPlatformId].filter(
      (v): v is string => typeof v === 'string'
    )
    const jobSlugs = [current.slug, data?.slug].filter(
      (v): v is string => typeof v === 'string'
    )
    await revalidatePublicSite({
      platformIds: Array.from(new Set(platformIds)),
      jobSlugs: Array.from(new Set(jobSlugs)),
    })

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

    // Capture platform_id + slug before archiving so we can invalidate cache
    const { data: before } = await supabase
      .from('job_postings')
      .select('platform_id, slug')
      .eq('id', id)
      .single()

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

    // Invalidate public-site cache for affected platform + slug
    await revalidatePublicSite({
      platformIds: before?.platform_id ? [before.platform_id] : [],
      jobSlugs: before?.slug ? [before.slug] : [],
    })

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
