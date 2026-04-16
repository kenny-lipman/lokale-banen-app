import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { rewriteVacancy } from '@/lib/services/vacancy-ai-rewrite.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function aiRewriteHandler(
  _req: NextRequest,
  authResult: AuthResult,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is verplicht' },
        { status: 400 }
      )
    }

    // Fetch vacancy with company info
    const { data: job, error: fetchError } = await supabase
      .from('job_postings')
      .select(`
        id, title, description, content_md, city, salary, employment,
        education_level, working_hours_min, working_hours_max,
        company_id,
        companies ( name )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !job) {
      return NextResponse.json(
        { success: false, error: 'Vacature niet gevonden' },
        { status: 404 }
      )
    }

    const company = job.companies as { name: string } | null

    if (!job.description) {
      return NextResponse.json(
        { success: false, error: 'Vacature heeft geen beschrijving om te herschrijven' },
        { status: 400 }
      )
    }

    // Call AI rewrite service
    const result = await rewriteVacancy({
      title: job.title,
      description: job.description,
      companyName: company?.name || 'Onbekend bedrijf',
      city: job.city,
      salary: job.salary,
      employment: job.employment,
      education_level: job.education_level,
      working_hours_min: job.working_hours_min,
      working_hours_max: job.working_hours_max,
    })

    return NextResponse.json({
      success: true,
      data: {
        content_md: result.content_md,
        extracted: result.extracted,
      },
    })
  } catch (error) {
    console.error('Error in AI rewrite:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI herschrijving mislukt',
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(aiRewriteHandler)
