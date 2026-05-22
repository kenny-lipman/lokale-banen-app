import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthResult } from '@/lib/auth-middleware'
import { getBrancheOptions } from '@/lib/services/sales-leads/branche-options.service'

export const runtime = 'nodejs'

async function handler(_req: NextRequest, _auth: AuthResult) {
  const options = await getBrancheOptions()
  return NextResponse.json({
    options: options.map((o) => ({
      enum_id: o.pipedrive_enum_id,
      label: o.label,
      sort_order: o.sort_order,
    })),
  })
}

export const GET = withAuth(handler)
