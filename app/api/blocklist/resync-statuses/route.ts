/**
 * Re-sync Pipedrive Organization Statuses API Route
 *
 * This endpoint re-syncs organization statuses to "Niet meer benaderen" for
 * blocklist entries that were already marked as pipedrive_synced.
 *
 * This is useful for entries that were synced before the blockOrganization
 * logic was added, where the note was added but the status wasn't changed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { resyncPipedriveStatuses } from '@/lib/blocklist-sync'

async function resyncHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`User ${authResult.user.email} initiated Pipedrive status re-sync`)

    const result = await resyncPipedriveStatuses()

    return NextResponse.json({
      success: true,
      message: 'Pipedrive status re-sync completed',
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Pipedrive status re-sync failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'PIPEDRIVE_RESYNC_FAILED'
    }, { status: 500 })
  }
}

export const POST = withAuth(resyncHandler)
