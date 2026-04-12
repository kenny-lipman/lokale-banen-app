/**
 * Blocklist Sync API Route
 * Syncs blocked contacts from Supabase to Instantly.ai
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { syncBlockedContacts } from '@/lib/blocklist-sync'

async function syncHandler(req: NextRequest, authResult: AuthResult) {
  try {
    console.log(`User ${authResult.user.email} initiated blocklist sync`)

    const result = await syncBlockedContacts()

    return NextResponse.json({
      success: true,
      message: 'Blocklist sync completed',
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Blocklist sync failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      code: 'SYNC_FAILED'
    }, { status: 500 })
  }
}

export const POST = withAuth(syncHandler)