// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, withAuth, AuthResult } from '@/lib/auth-middleware'
import {
  getSourcePreferences,
  isResetSourcePreferencesRequest,
  parseSourcePreferencePatch,
  resetSourcePreferences,
  updateSourcePreferences,
} from '@/lib/services/sales-leads/source-preferences'

export const runtime = 'nodejs'

async function getHandler(_req: NextRequest, _auth: AuthResult) {
  try {
    return NextResponse.json(await getSourcePreferences())
  } catch (error) {
    console.error('[sales-leads/source-preferences] GET failed:', error)
    return NextResponse.json({ error: 'Failed to fetch source preferences' }, { status: 500 })
  }
}

async function putHandler(req: NextRequest, auth: AuthResult) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    if (isResetSourcePreferencesRequest(body)) {
      return NextResponse.json(await resetSourcePreferences())
    }

    const patch = parseSourcePreferencePatch(body)
    return NextResponse.json(await updateSourcePreferences(patch, { updatedBy: auth.user.id }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update source preferences'
    const status = message.startsWith('Kon source preferences') ? 500 : 400
    if (status === 500) console.error('[sales-leads/source-preferences] PUT failed:', error)
    return NextResponse.json({ error: message }, { status })
  }
}

export const GET = withAuth(getHandler)
export const PUT = withAdminAuth(putHandler)
