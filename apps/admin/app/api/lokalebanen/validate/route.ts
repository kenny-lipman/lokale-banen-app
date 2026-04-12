import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { validateJobPostingsForPush } from '@/lib/services/lokalebanen-push.service'

/**
 * POST /api/lokalebanen/validate
 * Validate which job postings can be pushed to Lokale Banen
 */
async function handler(req: NextRequest, authResult: AuthResult) {
  const { supabase } = authResult

  try {
    const { jobPostingIds } = await req.json()

    if (!jobPostingIds || !Array.isArray(jobPostingIds) || jobPostingIds.length === 0) {
      return NextResponse.json({ success: false, error: 'jobPostingIds array is required' }, { status: 400 })
    }

    const result = await validateJobPostingsForPush(jobPostingIds, supabase)

    return NextResponse.json({
      success: true,
      ...result,
      summary: {
        total: jobPostingIds.length,
        valid: result.valid.length,
        invalid: result.invalid.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validation failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const POST = withAuth(handler)
