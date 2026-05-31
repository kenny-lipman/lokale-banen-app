// @auth ADMIN
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'

/**
 * Dedicated endpoint voor admin-UI selectors die altijd
 * { id, regio_platform } objects retourneert (geen string[]-fallback).
 */
async function handler(_req: NextRequest, auth: AuthResult) {
  const { data, error } = await auth.supabase
    .from('platforms')
    .select('id, regio_platform')
    .order('regio_platform', { ascending: true })
  if (error) {
    console.error('platforms/options error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ platforms: data ?? [] })
}

export const GET = withAdminAuth(handler)
