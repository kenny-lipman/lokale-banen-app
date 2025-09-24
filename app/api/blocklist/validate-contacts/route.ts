import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { contactFilteringService } from '@/lib/services/contact-filtering.service'

async function validateContactsHandler(req: NextRequest, authResult: AuthResult) {
  try {
    const body = await req.json()
    const { contacts, options = {} } = body

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json(
        { success: false, error: 'Invalid contacts array' },
        { status: 400 }
      )
    }

    const result = await contactFilteringService.validateCampaignContacts(contacts)

    return NextResponse.json({
      success: true,
      valid_contacts: result.valid_contacts,
      blocked_contacts: result.blocked_contacts,
      warnings: result.warnings
    })
  } catch (error) {
    console.error('Contact validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate contacts'
      },
      { status: 500 }
    )
  }
}

export const POST = withAuth(validateContactsHandler)