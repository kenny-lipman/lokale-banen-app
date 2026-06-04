// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { extractApex } from '@/lib/utils/url'

type CompanyMatch = { id: string; name: string; website: string | null }

async function matchCompanyHandler(req: NextRequest, authResult: AuthResult) {
  const url = new URL(req.url)
  const kvk = url.searchParams.get('kvk')?.trim() || ''
  const domain = url.searchParams.get('domain')?.trim() || ''
  const name = url.searchParams.get('name')?.trim() || ''
  const supabase = authResult.supabase

  // 1. KvK exact (meest betrouwbaar)
  if (kvk) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, website')
      .eq('kvk', kvk)
      .limit(1)
      .maybeSingle()
    if (data) return NextResponse.json({ match: data as CompanyMatch })
  }

  // 2. Website apex-domein
  if (domain) {
    const apex = extractApex(domain)
    if (apex) {
      const { data } = await supabase
        .from('companies')
        .select('id, name, website')
        .ilike('website', `%${apex}%`)
        .limit(1)
        .maybeSingle()
      if (data) return NextResponse.json({ match: data as CompanyMatch })
    }
  }

  // 3. Naam (ilike, hoge zekerheid)
  if (name) {
    const { data } = await supabase
      .from('companies')
      .select('id, name, website')
      .ilike('name', name)
      .limit(1)
      .maybeSingle()
    if (data) return NextResponse.json({ match: data as CompanyMatch })
  }

  return NextResponse.json({ match: null })
}

export const GET = withAuth(matchCompanyHandler)
