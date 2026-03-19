import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { getLokaleBanenClient } from '@/lib/lokalebanen-client'

/**
 * GET /api/lokalebanen/sync
 * Fetch fresh values from Lokale Banen API (domains, sectors, employments, educations)
 */
async function handler(_req: NextRequest, _authResult: AuthResult) {
  try {
    const client = getLokaleBanenClient()

    const [domains, sectors, employments, educations] = await Promise.all([
      client.getDomains(),
      client.getSectors(),
      client.getEmployments(),
      client.getEducations(),
    ])

    // Deduplicate (their API returns duplicates)
    const uniqueSectors = [...new Set(sectors)]
    const uniqueEducations = [...new Set(educations)]

    return NextResponse.json({
      success: true,
      data: {
        domains,
        sectors: uniqueSectors,
        employments,
        educations: uniqueEducations,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync with Lokale Banen API'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const GET = withAuth(handler)
