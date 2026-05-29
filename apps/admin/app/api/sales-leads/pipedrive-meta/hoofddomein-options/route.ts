// @auth SESSION
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(_req: NextRequest) {
  try {
    const service = new PipedriveMetaService()
    const options = await service.getHoofddomeinOptions()
    return NextResponse.json({ options })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAuth(handler)
